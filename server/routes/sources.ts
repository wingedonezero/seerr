import { getRepository } from '@server/datasource';
import MediaMetadata from '@server/entity/MediaMetadata';
import MediaSource from '@server/entity/MediaSource';
import SourceLog from '@server/entity/SourceLog';
import { Permission } from '@server/lib/permissions';
import { isAuthenticated } from '@server/middleware/auth';
import { ZipArchive } from 'archiver';
import { Router } from 'express';

/**
 * Disc/remux/encode source records + their logs — user-authored data with
 * its own vault (see MediaSource). Every mutation is a single small
 * transaction; nothing here is ever written by scanners or jobs.
 */
const sourcesRoutes = Router();

const VALID_KINDS = ['disc', 'remux', 'encode'];

const parseTitleParams = (params: Record<string, string>) => ({
  mediaType: (params.mediaType === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv',
  tmdbId: Number(params.tmdbId),
});

/** All sources (with logs) for a title, plus its episode-order state. */
sourcesRoutes.get('/:mediaType/:tmdbId', async (req, res, next) => {
  const { mediaType, tmdbId } = parseTitleParams(req.params);
  try {
    const [sources, meta] = await Promise.all([
      getRepository(MediaSource).find({
        where: { tmdbId, mediaType },
        relations: { logs: true },
        order: { seasonNumber: 'ASC', id: 'ASC' },
      }),
      getRepository(MediaMetadata).findOne({ where: { tmdbId, mediaType } }),
    ]);
    return res.status(200).json({
      sources,
      order: {
        detected: meta?.detectedOrder ?? '',
        override: meta?.orderOverride ?? '',
        effective: meta?.orderOverride || meta?.detectedOrder || 'aired',
      },
    });
  } catch (e) {
    return next({ status: 500, message: e.message });
  }
});

sourcesRoutes.post(
  '/:mediaType/:tmdbId',
  isAuthenticated(Permission.MANAGE_REQUESTS),
  async (req, res, next) => {
    const { mediaType, tmdbId } = parseTitleParams(req.params);
    const { kind, name, grp, info, seasonNumber } = req.body ?? {};
    if (!VALID_KINDS.includes(kind) || isNaN(tmdbId)) {
      return next({ status: 400, message: 'kind must be disc, remux or encode.' });
    }
    try {
      const source = await getRepository(MediaSource).save(
        new MediaSource({
          tmdbId,
          mediaType,
          kind,
          name: String(name ?? ''),
          grp: String(grp ?? ''),
          info: String(info ?? ''),
          seasonNumber:
            seasonNumber === null || seasonNumber === undefined
              ? null
              : Number(seasonNumber),
        })
      );
      return res.status(201).json(source);
    } catch (e) {
      return next({ status: 500, message: e.message });
    }
  }
);

sourcesRoutes.put(
  '/source/:id',
  isAuthenticated(Permission.MANAGE_REQUESTS),
  async (req, res, next) => {
    try {
      const repo = getRepository(MediaSource);
      const source = await repo.findOneOrFail({
        where: { id: Number(req.params.id) },
      });
      const { kind, name, grp, info, seasonNumber } = req.body ?? {};
      if (kind !== undefined) {
        if (!VALID_KINDS.includes(kind)) {
          return next({ status: 400, message: 'Invalid kind.' });
        }
        source.kind = kind;
      }
      if (name !== undefined) source.name = String(name);
      if (grp !== undefined) source.grp = String(grp);
      if (info !== undefined) source.info = String(info);
      if (seasonNumber !== undefined) {
        source.seasonNumber = seasonNumber === null ? null : Number(seasonNumber);
      }
      return res.status(200).json(await repo.save(source));
    } catch (e) {
      return next({ status: 500, message: e.message });
    }
  }
);

sourcesRoutes.delete(
  '/source/:id',
  isAuthenticated(Permission.MANAGE_REQUESTS),
  async (req, res, next) => {
    try {
      const repo = getRepository(MediaSource);
      const source = await repo.findOneOrFail({
        where: { id: Number(req.params.id) },
      });
      await repo.remove(source); // logs cascade — they belong to the source
      return res.status(200).json({ ok: true });
    } catch (e) {
      return next({ status: 500, message: e.message });
    }
  }
);

sourcesRoutes.post(
  '/source/:id/logs',
  isAuthenticated(Permission.MANAGE_REQUESTS),
  async (req, res, next) => {
    try {
      const source = await getRepository(MediaSource).findOneOrFail({
        where: { id: Number(req.params.id) },
      });
      const log = await getRepository(SourceLog).save(
        new SourceLog({
          source,
          title: String(req.body?.title ?? ''),
          body: String(req.body?.body ?? ''),
        })
      );
      return res.status(201).json({ ...log, source: undefined });
    } catch (e) {
      return next({ status: 500, message: e.message });
    }
  }
);

sourcesRoutes.put(
  '/logs/:logId',
  isAuthenticated(Permission.MANAGE_REQUESTS),
  async (req, res, next) => {
    try {
      const repo = getRepository(SourceLog);
      const log = await repo.findOneOrFail({
        where: { id: Number(req.params.logId) },
      });
      if (req.body?.title !== undefined) log.title = String(req.body.title);
      if (req.body?.body !== undefined) log.body = String(req.body.body);
      const saved = await repo.save(log);
      return res.status(200).json({ ...saved, source: undefined });
    } catch (e) {
      return next({ status: 500, message: e.message });
    }
  }
);

sourcesRoutes.delete(
  '/logs/:logId',
  isAuthenticated(Permission.MANAGE_REQUESTS),
  async (req, res, next) => {
    try {
      const repo = getRepository(SourceLog);
      const log = await repo.findOneOrFail({
        where: { id: Number(req.params.logId) },
      });
      await repo.remove(log);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return next({ status: 500, message: e.message });
    }
  }
);

// ---------------- export ----------------

const unsafeFile = /[\x00-\x1f/\\:*?"<>|]+/g;
const safeName = (s: string, fallback: string) => {
  const cleaned = s.replace(unsafeFile, ' ').trim().replace(/\.+$/, '');
  return (cleaned || fallback).slice(0, 120);
};

const writeTitleToArchive = async (
  archive: ZipArchive,
  mediaType: 'movie' | 'tv',
  tmdbId: number,
  root: string
) => {
  const sources = await getRepository(MediaSource).find({
    where: { tmdbId, mediaType },
    relations: { logs: true },
    order: { seasonNumber: 'ASC', id: 'ASC' },
  });
  const usedDirs = new Map<string, number>();
  for (const source of sources) {
    let dir = safeName(source.name, `${source.kind} ${source.id}`);
    const seen = (usedDirs.get(dir) ?? 0) + 1;
    usedDirs.set(dir, seen);
    if (seen > 1) dir = `${dir} (${seen})`;
    const seasonDir =
      source.seasonNumber === null || source.seasonNumber === undefined
        ? ''
        : source.seasonNumber === 0
          ? 'Specials/'
          : `Season ${source.seasonNumber}/`;
    const base = `${root}/${seasonDir}${dir}`;

    const infoLines = [
      `Name: ${source.name}`,
      `Kind: ${source.kind}`,
      ...(source.grp ? [`Group: ${source.grp}`] : []),
      ...(source.seasonNumber !== null && source.seasonNumber !== undefined
        ? [`Season: ${source.seasonNumber}`]
        : []),
      `Added: ${source.createdAt.toISOString().slice(0, 10)}`,
      ...(source.info ? ['', source.info] : []),
      '',
    ];
    archive.append(infoLines.join('\n'), { name: `${base}/info.txt` });

    const usedLogs = new Map<string, number>();
    for (const log of source.logs ?? []) {
      let logName = safeName(log.title, `log ${log.id}`);
      const seenLog = (usedLogs.get(logName) ?? 0) + 1;
      usedLogs.set(logName, seenLog);
      if (seenLog > 1) logName = `${logName} (${seenLog})`;
      archive.append(log.body, { name: `${base}/${logName}.txt` });
    }
  }
  return sources.length;
};

const titleRoot = async (mediaType: 'movie' | 'tv', tmdbId: number) => {
  const meta = await getRepository(MediaMetadata).findOne({
    where: { tmdbId, mediaType },
  });
  const name = safeName(meta?.title ?? '', `${mediaType}-${tmdbId}`);
  return meta?.year ? `${name} (${meta.year})` : name;
};

sourcesRoutes.get('/export/:mediaType/:tmdbId', async (req, res, next) => {
  const { mediaType, tmdbId } = parseTitleParams(req.params);
  try {
    const root = await titleRoot(mediaType, tmdbId);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${root}.zip"`
    );
    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.pipe(res);
    await writeTitleToArchive(archive, mediaType, tmdbId, root);
    await archive.finalize();
  } catch (e) {
    return next({ status: 500, message: e.message });
  }
});

sourcesRoutes.get('/export', async (_req, res, next) => {
  try {
    const all = await getRepository(MediaSource)
      .createQueryBuilder('source')
      .select(['source.tmdbId', 'source.mediaType'])
      .distinct(true)
      .getRawMany<{ source_tmdbId: number; source_mediaType: 'movie' | 'tv' }>();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="sources-export.zip"'
    );
    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.pipe(res);
    const usedRoots = new Map<string, number>();
    for (const row of all) {
      let root = await titleRoot(row.source_mediaType, row.source_tmdbId);
      const seen = (usedRoots.get(root) ?? 0) + 1;
      usedRoots.set(root, seen);
      if (seen > 1) root = `${root} (${seen})`;
      await writeTitleToArchive(
        archive,
        row.source_mediaType,
        row.source_tmdbId,
        root
      );
    }
    await archive.finalize();
  } catch (e) {
    return next({ status: 500, message: e.message });
  }
});

export default sourcesRoutes;
