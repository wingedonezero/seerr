import { getMetadataProvider } from '@server/api/metadata';
import TheMovieDb from '@server/api/themoviedb';
import Tvdb from '@server/api/tvdb';
import { ANIME_KEYWORD_ID } from '@server/api/themoviedb/constants';
import type { TmdbKeyword } from '@server/api/themoviedb/interfaces';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import MediaMetadata from '@server/entity/MediaMetadata';
import MetadataEpisode from '@server/entity/MetadataEpisode';
import logger from '@server/logger';

/**
 * Keeps the media_metadata table hydrated and fresh.
 *
 * Every title Seerr knows (a Media row exists) gets a durable metadata row so
 * grid views can browse the whole library from the local database — no
 * external API in the hot path, no dependence on the in-memory TMDB cache.
 *
 * Refresh tiers (how stale a row may get before the nightly job re-fetches):
 *   - ongoing / recently-aired TV .... 1 day  (new seasons surface quickly)
 *   - ended TV ...................... 7 days (specials still get added)
 *   - unreleased movies ............. 1 day  (release dates move)
 *   - released movies ............... 30 days
 *
 * When a refresh discovers season numbers a row didn't have before, they are
 * recorded in newSeasons (with a timestamp) until acknowledged through the
 * API — that's the "a new season exists" signal in the UI.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const REFRESH_ONGOING_TV_MS = 1 * DAY_MS;
const REFRESH_ENDED_TV_MS = 7 * DAY_MS;
const REFRESH_UPCOMING_MOVIE_MS = 1 * DAY_MS;
const REFRESH_MOVIE_MS = 30 * DAY_MS;
/** ~2 fetches/second keeps first-time hydration polite to the providers */
const PACE_MS = 500;
/** ongoing = aired within this window, or provider says it's still running */
const ONGOING_WINDOW_MS = 90 * DAY_MS;

const ONGOING_STATUSES = ['Returning Series', 'In Production', 'Planned'];

interface SeasonSummary {
  seasonNumber: number;
  episodeCount: number;
  airDate: string | null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class MetadataRefresh {
  public running = false;
  private cancelled = false;
  private progress = 0;
  private total = 0;

  public status() {
    return { running: this.running, progress: this.progress, total: this.total };
  }

  public cancel() {
    this.cancelled = true;
  }

  private isDue(row: MediaMetadata, now: number): boolean {
    if (!row.lastRefreshedAt) {
      return true;
    }
    const age = now - new Date(row.lastRefreshedAt).getTime();
    if (row.mediaType === 'tv') {
      const ongoing =
        ONGOING_STATUSES.includes(row.seriesStatus) ||
        (row.lastAirDate &&
          now - new Date(row.lastAirDate).getTime() < ONGOING_WINDOW_MS);
      return age > (ongoing ? REFRESH_ONGOING_TV_MS : REFRESH_ENDED_TV_MS);
    }
    const unreleased =
      !row.releaseDate || new Date(row.releaseDate).getTime() > now;
    return age > (unreleased ? REFRESH_UPCOMING_MOVIE_MS : REFRESH_MOVIE_MS);
  }

  /** Fetch current provider data for one title and upsert its metadata row. */
  public async refreshTitle(
    mediaType: MediaType.MOVIE | MediaType.TV,
    tmdbId: number
  ): Promise<MediaMetadata> {
    const metadataRepository = getRepository(MediaMetadata);
    const existing = await metadataRepository.findOne({
      where: { tmdbId, mediaType },
    });
    const row =
      existing ?? new MediaMetadata({ tmdbId, mediaType, seasons: '[]', newSeasons: '[]' });

    const tmdb = new TheMovieDb();

    if (mediaType === MediaType.TV) {
      const tmdbTv = await tmdb.getTvShow({ tvId: tmdbId });
      const isAnime = tmdbTv.keywords.results.some(
        (keyword: TmdbKeyword) => keyword.id === ANIME_KEYWORD_ID
      );
      const provider = await getMetadataProvider(isAnime ? 'anime' : 'tv');
      const tv =
        provider instanceof TheMovieDb
          ? tmdbTv
          : await provider.getTvShow({ tvId: tmdbId });

      const seasons: SeasonSummary[] = (tv.seasons ?? []).map((s) => ({
        seasonNumber: s.season_number,
        episodeCount: s.episode_count,
        airDate: s.air_date ?? null,
      }));

      // Season diff — only after a real prior refresh, so first hydration
      // doesn't flag the entire back catalogue as "new".
      if (row.lastRefreshedAt) {
        const known = new Set(
          (JSON.parse(row.seasons || '[]') as SeasonSummary[]).map(
            (s) => s.seasonNumber
          )
        );
        const appeared = seasons
          .map((s) => s.seasonNumber)
          .filter((n) => !known.has(n));
        if (appeared.length > 0) {
          const pending = new Set<number>(
            JSON.parse(row.newSeasons || '[]') as number[]
          );
          appeared.forEach((n) => pending.add(n));
          row.newSeasons = JSON.stringify([...pending].sort((a, b) => a - b));
          row.newSeasonsDetectedAt = new Date();
          logger.info(
            `New season(s) detected for ${tv.name}: ${appeared.join(', ')}`,
            { label: 'Metadata Refresh' }
          );
        }
      }

      row.title = tv.name ?? '';
      row.originalTitle = tv.original_name ?? '';
      row.year =
        parseInt((tv.first_air_date ?? '').slice(0, 4), 10) || null;
      row.posterPath = tv.poster_path ?? '';
      row.backdropPath = tv.backdrop_path ?? '';
      row.overview = tv.overview ?? '';
      row.seriesStatus = tv.status ?? '';
      row.lastAirDate = tv.last_air_date ?? null;
      row.seasons = JSON.stringify(seasons);
      row.genres = JSON.stringify((tv.genres ?? []).map((g) => g.name));
      row.runtime = tv.episode_run_time?.[0] ?? null;
      row.network = tv.networks?.[0]?.name ?? '';
      row.certification =
        tv.content_ratings?.results?.find((r) => r.iso_3166_1 === 'US')
          ?.rating ?? '';
      row.tvdbId = tmdbTv.external_ids?.tvdb_id ?? row.tvdbId ?? null;
      row.imdbId = tmdbTv.external_ids?.imdb_id ?? row.imdbId ?? null;

      const saved = await metadataRepository.save(
        Object.assign(row, { lastRefreshedAt: new Date() })
      );
      await this.syncEpisodes(saved, provider, seasons);
      return saved;
    }

    const movie = await tmdb.getMovie({ movieId: tmdbId });
    row.title = movie.title ?? '';
    row.originalTitle = movie.original_title ?? '';
    row.year = parseInt((movie.release_date ?? '').slice(0, 4), 10) || null;
    row.posterPath = movie.poster_path ?? '';
    row.backdropPath = movie.backdrop_path ?? '';
    row.overview = movie.overview ?? '';
    row.releaseDate = movie.release_date ?? null;
    row.genres = JSON.stringify((movie.genres ?? []).map((g) => g.name));
    row.runtime = movie.runtime ?? null;
    row.certification =
      movie.release_dates?.results
        ?.find((r) => r.iso_3166_1 === 'US')
        ?.release_dates?.find((d) => d.certification)?.certification ?? '';
    row.imdbId = movie.external_ids?.imdb_id ?? row.imdbId ?? null;

    row.lastRefreshedAt = new Date();
    return metadataRepository.save(row);
  }

  /**
   * Change-limited per-episode sync: a season's episodes are (re)fetched only
   * when we hold a different number of rows than the provider reports, or for
   * the newest season of a still-airing show (titles/dates firm up there).
   */
  private async syncEpisodes(
    row: MediaMetadata,
    provider: Awaited<ReturnType<typeof getMetadataProvider>> | TheMovieDb,
    seasons: SeasonSummary[]
  ): Promise<void> {
    const episodeRepository = getRepository(MetadataEpisode);
    const stored = await episodeRepository.find({
      where: { metadata: { id: row.id } },
      relations: { metadata: false },
    });
    const storedPerSeason = new Map<number, number>();
    for (const e of stored) {
      storedPerSeason.set(
        e.seasonNumber,
        (storedPerSeason.get(e.seasonNumber) ?? 0) + 1
      );
    }
    const ongoing = ONGOING_STATUSES.includes(row.seriesStatus);
    const newestSeason = Math.max(0, ...seasons.map((s) => s.seasonNumber));
    let episodesChanged = false;

    for (const season of seasons) {
      const have = storedPerSeason.get(season.seasonNumber) ?? 0;
      const isLiveSeason = ongoing && season.seasonNumber === newestSeason;
      if (have === season.episodeCount && !isLiveSeason) {
        continue;
      }
      episodesChanged = true;
      try {
        const data = await provider.getTvSeason({
          tvId: row.tmdbId,
          seasonNumber: season.seasonNumber,
        });
        await episodeRepository.manager.transaction(async (em) => {
          await em.delete(MetadataEpisode, {
            metadata: { id: row.id },
            seasonNumber: season.seasonNumber,
          });
          for (const ep of data.episodes ?? []) {
            await em.save(
              new MetadataEpisode({
                metadata: row,
                seasonNumber: season.seasonNumber,
                episodeNumber: ep.episode_number,
                title: ep.name ?? '',
                airDate: ep.air_date ?? null,
                overview: ep.overview ?? '',
                runtime: (ep as { runtime?: number }).runtime ?? null,
                providerEpisodeId: ep.id ?? null,
              })
            );
          }
        });
      } catch (e) {
        logger.warn(
          `Episode sync failed for tmdb:${row.tmdbId} S${season.seasonNumber}: ${e.message}`,
          { label: 'Metadata Refresh' }
        );
      }
      await sleep(PACE_MS);
    }

    // Alternate orderings (DVD/absolute) come from TVDB season types and are
    // matched onto the aired-keyed rows by TVDB episode id. Refetched only
    // when the episode set itself changed.
    if (episodesChanged && row.tvdbId && provider instanceof Tvdb) {
      await this.syncAlternateOrders(row, provider);
    }
  }

  private async syncAlternateOrders(
    row: MediaMetadata,
    tvdb: Tvdb
  ): Promise<void> {
    const episodeRepository = getRepository(MetadataEpisode);
    try {
      const [dvd, absolute] = [
        await tvdb.getEpisodesBySeasonType(row.tvdbId as number, 'dvd'),
        await tvdb.getEpisodesBySeasonType(row.tvdbId as number, 'absolute'),
      ];
      await episodeRepository.manager.transaction(async (em) => {
        for (const ep of dvd) {
          await em.update(
            MetadataEpisode,
            { metadata: { id: row.id }, providerEpisodeId: ep.id },
            { dvdSeasonNumber: ep.seasonNumber, dvdEpisodeNumber: ep.number }
          );
        }
        for (const ep of absolute) {
          await em.update(
            MetadataEpisode,
            { metadata: { id: row.id }, providerEpisodeId: ep.id },
            { absoluteNumber: ep.number }
          );
        }
      });
      if (dvd.length || absolute.length) {
        logger.debug(
          `Alternate orderings stored for tvdb:${row.tvdbId} (dvd: ${dvd.length}, absolute: ${absolute.length})`,
          { label: 'Metadata Refresh' }
        );
      }
    } catch (e) {
      logger.warn(
        `Alternate-order sync failed for tvdb:${row.tvdbId}: ${e.message}`,
        { label: 'Metadata Refresh' }
      );
    }
  }

  /** Clear the new-season flag once the user has seen/acted on it. */
  public async acknowledgeNewSeasons(
    mediaType: MediaType.MOVIE | MediaType.TV,
    tmdbId: number
  ): Promise<void> {
    const metadataRepository = getRepository(MediaMetadata);
    await metadataRepository.update(
      { tmdbId, mediaType },
      { newSeasons: '[]', newSeasonsDetectedAt: null }
    );
  }

  /** Hydrate missing rows and refresh due ones. Runs from the scheduled job. */
  public async run(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    this.cancelled = false;
    this.progress = 0;

    try {
      const mediaRepository = getRepository(Media);
      const metadataRepository = getRepository(MediaMetadata);

      const allMedia = await mediaRepository.find({
        select: ['tmdbId', 'mediaType'],
      });
      const allRows = await metadataRepository.find();
      const byKey = new Map(
        allRows.map((r) => [`${r.mediaType}:${r.tmdbId}`, r])
      );

      const now = Date.now();
      const queue: { mediaType: MediaType.MOVIE | MediaType.TV; tmdbId: number }[] = [];

      for (const media of allMedia) {
        const row = byKey.get(`${media.mediaType}:${media.tmdbId}`);
        if (!row || this.isDue(row, now)) {
          queue.push({
            mediaType: media.mediaType as MediaType.MOVIE | MediaType.TV,
            tmdbId: media.tmdbId,
          });
        }
      }
      // rows whose media was deleted still refresh on the slow tier is not
      // useful — skip them; they keep their last-known snapshot.

      this.total = queue.length;
      logger.info(
        `Metadata refresh: ${queue.length} title(s) to hydrate/refresh`,
        { label: 'Metadata Refresh' }
      );

      for (const item of queue) {
        if (this.cancelled) {
          break;
        }
        try {
          await this.refreshTitle(item.mediaType, item.tmdbId);
        } catch (e) {
          logger.warn(
            `Metadata refresh failed for ${item.mediaType}:${item.tmdbId}: ${e.message}`,
            { label: 'Metadata Refresh' }
          );
        }
        this.progress++;
        await sleep(PACE_MS);
      }

      logger.info(
        `Metadata refresh finished: ${this.progress} of ${this.total} processed`,
        { label: 'Metadata Refresh' }
      );
    } catch (e) {
      logger.error(`Metadata refresh run failed: ${e.message}`, {
        label: 'Metadata Refresh',
      });
    } finally {
      this.running = false;
    }
  }
}

const metadataRefresh = new MetadataRefresh();

export default metadataRefresh;
