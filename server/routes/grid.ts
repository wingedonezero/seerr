import JellyfinAPI from '@server/api/jellyfin';
import { MediaStatus, MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Episode from '@server/entity/Episode';
import Media from '@server/entity/Media';
import MediaFlag from '@server/entity/MediaFlag';
import MediaMetadata from '@server/entity/MediaMetadata';
import MediaVersion from '@server/entity/MediaVersion';
import MetadataEpisode from '@server/entity/MetadataEpisode';
import { MediaRequest } from '@server/entity/MediaRequest';
import { User } from '@server/entity/User';
import { getSettings } from '@server/lib/settings';
import { getHostname } from '@server/utils/getHostname';
import metadataRefresh from '@server/lib/metadatarefresh';
import { Permission } from '@server/lib/permissions';
import logger from '@server/logger';
import { isAuthenticated } from '@server/middleware/auth';
import { Router } from 'express';

/**
 * Grid API — serves whole-library views (the poster-grid Requests page and
 * friends) entirely from the local database: media + seasons + requests
 * joined with the durable media_metadata rows. No external API is touched
 * in this hot path; hydration/freshness is the metadata-refresh job's job.
 */
const gridRoutes = Router();

gridRoutes.get('/', async (req, res, next) => {
  try {
    const mediaRepository = getRepository(Media);
    const metadataRepository = getRepository(MediaMetadata);

    const [media, metadataRows, flagRows] = await Promise.all([
      mediaRepository.find({
        relations: { seasons: true, requests: { seasons: true } },
      }),
      metadataRepository.find(),
      getRepository(MediaFlag).find(),
    ]);

    const metaByKey = new Map(
      metadataRows.map((row) => [`${row.mediaType}:${row.tmdbId}`, row])
    );
    const flagsByKey = new Map<string, string[]>();
    for (const f of flagRows) {
      const key = `${f.mediaType}:${f.tmdbId}`;
      flagsByKey.set(key, [...(flagsByKey.get(key) ?? []), f.flag]);
    }

    const items = media.map((m) => {
      const meta = metaByKey.get(`${m.mediaType}:${m.tmdbId}`);
      const requestedSeasons = new Set<number>();
      for (const request of m.requests ?? []) {
        for (const season of request.seasons ?? []) {
          requestedSeasons.add(season.seasonNumber);
        }
      }
      return {
        id: m.id,
        tmdbId: m.tmdbId,
        tvdbId: m.tvdbId ?? meta?.tvdbId ?? null,
        mediaType: m.mediaType,
        status: m.status,
        status4k: m.status4k,
        mediaAddedAt: m.mediaAddedAt,
        createdAt: m.createdAt,
        seasons: (m.seasons ?? []).map((s) => ({
          seasonNumber: s.seasonNumber,
          status: s.status,
        })),
        requestIds: (m.requests ?? []).map((r) => r.id),
        requestedSeasons: [...requestedSeasons].sort((a, b) => a - b),
        firstRequestedAt:
          (m.requests ?? []).reduce<Date | null>(
            (min, r) => (!min || r.createdAt < min ? r.createdAt : min),
            null
          ) ?? null,
        flags: flagsByKey.get(`${m.mediaType}:${m.tmdbId}`) ?? [],
        metadata: meta
          ? {
              title: meta.title,
              originalTitle: meta.originalTitle,
              year: meta.year,
              posterPath: meta.posterPath,
              backdropPath: meta.backdropPath,
              overview: meta.overview,
              seriesStatus: meta.seriesStatus,
              genres: JSON.parse(meta.genres || '[]'),
              runtime: meta.runtime,
              certification: meta.certification,
              network: meta.network,
              detectedOrder: meta.detectedOrder,
              orderOverride: meta.orderOverride,
              seasons: JSON.parse(meta.seasons || '[]'),
              newSeasons: JSON.parse(meta.newSeasons || '[]'),
              newSeasonsDetectedAt: meta.newSeasonsDetectedAt,
              lastRefreshedAt: meta.lastRefreshedAt,
            }
          : null,
      };
    });

    return res.status(200).json({
      items,
      hydrated: items.filter((i) => i.metadata).length,
      refresh: metadataRefresh.status(),
    });
  } catch (e) {
    return next({ status: 500, message: e.message });
  }
});

/** Kick a hydration/refresh pass (also runs nightly on its own). */
gridRoutes.post(
  '/refresh',
  isAuthenticated(Permission.ADMIN),
  (_req, res) => {
    metadataRefresh.run();
    return res.status(202).json(metadataRefresh.status());
  }
);

/** Refresh a single title's metadata right now (detail views, manual button). */
gridRoutes.post('/refresh/:mediaType/:tmdbId', async (req, res, next) => {
  const mediaType =
    req.params.mediaType === 'tv' ? MediaType.TV : MediaType.MOVIE;
  try {
    const row = await metadataRefresh.refreshTitle(
      mediaType,
      Number(req.params.tmdbId)
    );
    return res.status(200).json(row);
  } catch (e) {
    return next({ status: 500, message: e.message });
  }
});

/** Clear the "new season" flag for a title. */
gridRoutes.post('/ack-new-seasons/:mediaType/:tmdbId', async (req, res, next) => {
  const mediaType =
    req.params.mediaType === 'tv' ? MediaType.TV : MediaType.MOVIE;
  try {
    await metadataRefresh.acknowledgeNewSeasons(
      mediaType,
      Number(req.params.tmdbId)
    );
    return res.status(200).json({ ok: true });
  } catch (e) {
    return next({ status: 500, message: e.message });
  }
});

/**
 * Episode list in the series' EFFECTIVE ordering, from local data only.
 * Availability is joined from the per-episode tracking rows, which are keyed
 * by the library's own numbering — identical to the display numbering here.
 */
gridRoutes.get('/episodes/:mediaType/:tmdbId', async (req, res, next) => {
  const mediaType = req.params.mediaType === 'tv' ? 'tv' : 'movie';
  const tmdbId = Number(req.params.tmdbId);
  try {
    const meta = await getRepository(MediaMetadata).findOne({
      where: { tmdbId, mediaType },
    });
    if (!meta) {
      return res.status(200).json({ effective: 'aired', seasons: [] });
    }
    const effective = (meta.orderOverride || meta.detectedOrder || 'aired') as
      | 'aired'
      | 'dvd'
      | 'absolute';
    const episodes = await getRepository(MetadataEpisode).find({
      where: { metadata: { id: meta.id } },
    });

    // availability map in library numbering: media -> seasons -> episode rows
    const media = await getRepository(Media).findOne({
      where: {
        tmdbId,
        mediaType: mediaType === 'tv' ? MediaType.TV : MediaType.MOVIE,
      },
      relations: { seasons: true },
    });
    const availableSet = new Set<string>();
    if (media) {
      for (const season of media.seasons ?? []) {
        const rows = await getRepository(Episode).find({
          where: { season: { id: season.id } },
        });
        for (const ep of rows) {
          if (ep.status === MediaStatus.AVAILABLE) {
            availableSet.add(`${season.seasonNumber}:${ep.episodeNumber}`);
          }
        }
      }
    }

    type DisplayEp = {
      episodeNumber: number;
      title: string;
      airDate: string | null;
      overview: string;
      available: boolean;
    };
    const bySeason = new Map<number, DisplayEp[]>();
    // aired seasons with zero mapped episodes (typically Specials) — they
    // keep their own aired rows in the ordered season view
    const airedMapped = new Map<number, { mapped: number; total: number }>();
    for (const ep of episodes) {
      let s: number | null = null;
      let e: number | null = null;
      if (effective === 'dvd') {
        s = ep.dvdSeasonNumber ?? null;
        e = ep.dvdEpisodeNumber ?? null;
      } else if (effective === 'absolute') {
        s = ep.absoluteNumber != null ? 1 : null;
        e = ep.absoluteNumber ?? null;
      } else {
        s = ep.seasonNumber;
        e = ep.episodeNumber;
      }
      const stat = airedMapped.get(ep.seasonNumber) ?? { mapped: 0, total: 0 };
      stat.total++;
      if (s !== null && e !== null) {
        stat.mapped++;
      }
      airedMapped.set(ep.seasonNumber, stat);
      if (s === null || e === null) {
        continue;
      }
      const list = bySeason.get(s) ?? [];
      list.push({
        episodeNumber: e,
        title: ep.title,
        airDate: ep.airDate ?? null,
        overview: ep.overview,
        available: availableSet.has(`${s}:${e}`),
      });
      bySeason.set(s, list);
    }
    const seasons = [...bySeason.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([seasonNumber, list]) => ({
        seasonNumber,
        episodeCount: list.length,
        episodes: list.sort((a, b) => a.episodeNumber - b.episodeNumber),
      }));
    return res.status(200).json({
      effective,
      detected: meta.detectedOrder,
      override: meta.orderOverride,
      seasons,
      unmappedSeasons: [...airedMapped.entries()]
        .filter(([, stat]) => stat.mapped === 0)
        .map(([seasonNumber, stat]) => ({
          seasonNumber,
          episodeCount: stat.total,
        })),
    });
  } catch (e) {
    return next({ status: 500, message: e.message });
  }
});

/** Library versions of a title (deliberate Jellyfin duplicates), from scan data. */
gridRoutes.get('/versions/:mediaType/:tmdbId', async (req, res, next) => {
  const mediaType = req.params.mediaType === 'tv' ? 'tv' : 'movie';
  const tmdbId = Number(req.params.tmdbId);
  try {
    const rows = await getRepository(MediaVersion).find({
      where: { tmdbId, mediaType },
      order: { isMain: 'DESC', label: 'ASC' },
    });
    return res.status(200).json({
      versions: rows.map((v) => ({
        id: v.id,
        title: v.title,
        label: v.label,
        isMain: v.isMain,
        coverage: JSON.parse(v.coverage || '[]'),
        lastSeenAt: v.lastSeenAt,
      })),
    });
  } catch (e) {
    return next({ status: 500, message: e.message });
  }
});

/** Flat file listing per version, live from Jellyfin's database (no disk touch). */
gridRoutes.get('/files/:mediaType/:tmdbId', async (req, res, next) => {
  const mediaType = req.params.mediaType === 'tv' ? 'tv' : 'movie';
  const tmdbId = Number(req.params.tmdbId);
  try {
    const versions = await getRepository(MediaVersion).find({
      where: { tmdbId, mediaType },
      order: { isMain: 'DESC', label: 'ASC' },
    });
    const settings = getSettings();
    const admin = await getRepository(User).findOne({
      where: {},
      select: ['id', 'jellyfinUserId', 'jellyfinDeviceId'],
      order: { id: 'ASC' },
    });
    const jf = new JellyfinAPI(
      getHostname(),
      settings.jellyfin.apiKey,
      admin?.jellyfinDeviceId
    );
    jf.setUserId(admin?.jellyfinUserId ?? '');

    const out = [];
    for (const v of versions) {
      const files: {
        season?: number;
        episode?: number;
        episodeEnd?: number;
        name?: string;
        path: string;
        size?: number;
      }[] = [];
      try {
        if (mediaType === 'movie') {
          const item = await jf.getItemData(v.jellyfinItemId);
          for (const ms of item?.MediaSources ?? []) {
            files.push({ path: ms.Path, size: ms.Size });
          }
        } else {
          const seasons = await jf.getSeasons(v.jellyfinItemId);
          for (const season of seasons) {
            const episodes = await jf.getEpisodes(
              v.jellyfinItemId,
              season.Id,
              { includeMediaInfo: true }
            );
            for (const ep of episodes) {
              files.push({
                season: ep.ParentIndexNumber,
                episode: ep.IndexNumber,
                episodeEnd: ep.IndexNumberEnd,
                name: ep.Name,
                path: ep.MediaSources?.[0]?.Path ?? '',
                size: ep.MediaSources?.[0]?.Size,
              });
            }
          }
        }
      } catch (e) {
        logger.warn(
          `File listing failed for version "${v.title}": ${e.message}`,
          { label: 'Grid' }
        );
      }
      out.push({
        title: v.title,
        label: v.label,
        isMain: v.isMain,
        files,
      });
    }
    return res.status(200).json({ versions: out });
  } catch (e) {
    return next({ status: 500, message: e.message });
  }
});

/** Set/clear the per-series episode-order override ('' = auto-detect). */
gridRoutes.post('/order/:mediaType/:tmdbId', async (req, res, next) => {
  const mediaType = req.params.mediaType === 'tv' ? 'tv' : 'movie';
  const tmdbId = Number(req.params.tmdbId);
  const order = String(req.body?.order ?? '');
  if (!['', 'aired', 'dvd', 'absolute'].includes(order) || isNaN(tmdbId)) {
    return next({ status: 400, message: 'order must be aired, dvd, absolute or empty.' });
  }
  try {
    await getRepository(MediaMetadata).update(
      { tmdbId, mediaType },
      { orderOverride: order }
    );
    return res.status(200).json({ order });
  } catch (e) {
    return next({ status: 500, message: e.message });
  }
});

/** Toggle a user flag ('downloading' | 'tobuy') on a title. */
gridRoutes.post('/flag/:mediaType/:tmdbId/:flag', async (req, res, next) => {
  const mediaType = req.params.mediaType === 'tv' ? 'tv' : 'movie';
  const tmdbId = Number(req.params.tmdbId);
  const flag = req.params.flag;
  if (!['downloading', 'tobuy'].includes(flag) || isNaN(tmdbId)) {
    return next({ status: 400, message: 'Unknown flag or bad tmdbId.' });
  }
  try {
    const flagRepository = getRepository(MediaFlag);
    const existing = await flagRepository.findOne({
      where: { tmdbId, mediaType, flag },
    });
    if (existing) {
      await flagRepository.remove(existing);
      return res.status(200).json({ flag, set: false });
    }
    await flagRepository.save(new MediaFlag({ tmdbId, mediaType, flag }));
    return res.status(200).json({ flag, set: true });
  } catch (e) {
    return next({ status: 500, message: e.message });
  }
});

/** Bulk-delete requests (grid multi-select). Manager permission required. */
gridRoutes.post(
  '/bulk-delete-requests',
  isAuthenticated(Permission.MANAGE_REQUESTS),
  async (req, res, next) => {
    const requestIds: number[] = Array.isArray(req.body?.requestIds)
      ? req.body.requestIds.map(Number).filter((n: number) => !isNaN(n))
      : [];
    if (requestIds.length === 0) {
      return next({ status: 400, message: 'requestIds must be a non-empty array.' });
    }
    try {
      const requestRepository = getRepository(MediaRequest);
      const requests = await requestRepository.findByIds(requestIds);
      await requestRepository.remove(requests);
      logger.info(`Bulk-deleted ${requests.length} request(s)`, {
        label: 'Grid',
      });
      return res.status(200).json({ deleted: requests.length });
    } catch (e) {
      return next({ status: 500, message: e.message });
    }
  }
);

export default gridRoutes;
