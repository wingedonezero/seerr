import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import MediaMetadata from '@server/entity/MediaMetadata';
import { MediaRequest } from '@server/entity/MediaRequest';
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

    const [media, metadataRows] = await Promise.all([
      mediaRepository.find({
        relations: { seasons: true, requests: { seasons: true } },
      }),
      metadataRepository.find(),
    ]);

    const metaByKey = new Map(
      metadataRows.map((row) => [`${row.mediaType}:${row.tmdbId}`, row])
    );

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
        metadata: meta
          ? {
              title: meta.title,
              originalTitle: meta.originalTitle,
              year: meta.year,
              posterPath: meta.posterPath,
              overview: meta.overview,
              seriesStatus: meta.seriesStatus,
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
