import { getRepository } from '@server/datasource';
import MediaMetadata from '@server/entity/MediaMetadata';
import MetadataEpisode from '@server/entity/MetadataEpisode';
import logger from '@server/logger';

/**
 * Episode-order detection — entirely from metadata, never the filesystem
 * (media disks stay asleep; Jellyfin answers from its own database).
 *
 * The scanner hands us the (season, episode, title) tuples Jellyfin reports
 * for a series; we score them against the stored orderings (aired rows, and
 * the DVD/absolute numbers TVDB mapped onto the same rows). Matching titles
 * count double — a title landing on the right number is the strongest
 * signal, and settles split-episode cases like aired two-parters that discs
 * combine. Ties go to aired; an explicit per-series override always wins.
 */

export interface JellyfinEpisodeTuple {
  seasonNumber: number;
  episodeNumber: number;
  /** last episode a combined file spans (IndexNumberEnd), if any */
  endEpisodeNumber?: number;
  name: string;
}

export interface OrderAssessment {
  /** '' when nothing could be detected */
  detected: string;
  /** override ?? detected ?? aired */
  effective: 'aired' | 'dvd' | 'absolute';
  /** expected episode count per season in the effective ordering */
  expectedBySeason: Map<number, number>;
  /** exact expected episode numbers per season — enables set-coverage checks */
  expectedNumbersBySeason: Map<number, Set<number>>;
  /**
   * Translation from effective-order position back to aired positions:
   * "s:e" (effective) -> aired (season, episode) pairs. One effective episode
   * can map to several aired ones (a disc combining an aired two-parter) and
   * across seasons (a miniseries filed as S1E1-E2 maps to aired specials).
   * Grading aired seasons through this map keeps request fulfillment exact
   * in every ordering.
   */
  toAired: Map<string, [number, number][]>;
  /**
   * Per aired season: how many episodes exist, how many carry effective-order
   * numbers, and which effective season most of them live in. TVDB's
   * alternate-order data is sometimes incomplete for older shows — these
   * stats let the scanner credit unmapped aired episodes from surplus
   * library coverage (files at effective positions TVDB never mapped).
   */
  airedSeasonStats: Map<
    number,
    { total: number; mapped: number; effSeason: number | null }
  >;
  /** every effective position TVDB mapped, per effective season */
  effMappedPositions: Map<number, Set<number>>;
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const assessOrder = async (
  mediaType: 'movie' | 'tv',
  tmdbId: number,
  jellyfinEpisodes: JellyfinEpisodeTuple[]
): Promise<OrderAssessment | null> => {
  const metadataRepository = getRepository(MediaMetadata);
  const row = await metadataRepository.findOne({
    where: { tmdbId, mediaType },
  });
  if (!row) {
    return null;
  }
  const episodes = await getRepository(MetadataEpisode).find({
    where: { metadata: { id: row.id } },
  });
  if (episodes.length === 0 || jellyfinEpisodes.length === 0) {
    return null;
  }

  type Keyed = Map<string, string>; // "s:e" -> normalized title
  const airedMap: Keyed = new Map();
  const dvdMap: Keyed = new Map();
  const absoluteMap: Keyed = new Map();
  for (const ep of episodes) {
    const title = normalize(ep.title);
    airedMap.set(`${ep.seasonNumber}:${ep.episodeNumber}`, title);
    if (ep.dvdSeasonNumber != null && ep.dvdEpisodeNumber != null) {
      dvdMap.set(`${ep.dvdSeasonNumber}:${ep.dvdEpisodeNumber}`, title);
    }
    if (ep.absoluteNumber != null) {
      absoluteMap.set(`1:${ep.absoluteNumber}`, title);
    }
  }

  const score = (map: Keyed): number => {
    let s = 0;
    for (const jf of jellyfinEpisodes) {
      const stored = map.get(`${jf.seasonNumber}:${jf.episodeNumber}`);
      if (stored !== undefined) {
        s += 1;
        if (stored && stored === normalize(jf.name)) {
          s += 2; // right title on the right number — the decisive signal
        }
      }
    }
    return s;
  };

  const airedScore = score(airedMap);
  const dvdScore = dvdMap.size > 0 ? score(dvdMap) : -1;
  const absoluteScore = absoluteMap.size > 0 ? score(absoluteMap) : -1;

  let detected = '';
  if (dvdScore > airedScore && dvdScore >= absoluteScore) {
    detected = 'dvd';
  } else if (absoluteScore > airedScore && absoluteScore > dvdScore) {
    detected = 'absolute';
  } else if (airedScore > 0) {
    detected = 'aired';
  }

  if (detected && detected !== row.detectedOrder) {
    await metadataRepository.update(
      { id: row.id },
      { detectedOrder: detected }
    );
    if (detected !== 'aired') {
      logger.info(
        `Detected ${detected.toUpperCase()} ordering for ${row.title || `tmdb:${tmdbId}`} (aired ${airedScore} / dvd ${dvdScore} / absolute ${absoluteScore})`,
        { label: 'Order Detection' }
      );
    }
  }

  const effective = ((row.orderOverride || detected || 'aired') === 'dvd'
    ? 'dvd'
    : (row.orderOverride || detected || 'aired') === 'absolute'
      ? 'absolute'
      : 'aired') as OrderAssessment['effective'];

  const expectedNumbersBySeason = new Map<number, Set<number>>();
  const addExpected = (s: number, e: number) => {
    const set = expectedNumbersBySeason.get(s) ?? new Set<number>();
    set.add(e);
    expectedNumbersBySeason.set(s, set);
  };
  if (effective === 'dvd') {
    for (const ep of episodes) {
      if (ep.dvdSeasonNumber != null && ep.dvdEpisodeNumber != null) {
        addExpected(ep.dvdSeasonNumber, ep.dvdEpisodeNumber);
      }
    }
  } else if (effective === 'absolute') {
    for (const ep of episodes) {
      if (ep.absoluteNumber != null) {
        addExpected(1, ep.absoluteNumber);
      }
    }
  } else {
    for (const ep of episodes) {
      addExpected(ep.seasonNumber, ep.episodeNumber);
    }
  }
  const expectedBySeason = new Map<number, number>(
    [...expectedNumbersBySeason.entries()].map(([s, set]) => [s, set.size])
  );

  const toAired = new Map<string, [number, number][]>();
  const addMapping = (key: string, s: number, e: number) => {
    const list = toAired.get(key) ?? [];
    list.push([s, e]);
    toAired.set(key, list);
  };
  for (const ep of episodes) {
    if (effective === 'dvd') {
      if (ep.dvdSeasonNumber != null && ep.dvdEpisodeNumber != null) {
        addMapping(
          `${ep.dvdSeasonNumber}:${ep.dvdEpisodeNumber}`,
          ep.seasonNumber,
          ep.episodeNumber
        );
      }
    } else if (effective === 'absolute') {
      if (ep.absoluteNumber != null) {
        addMapping(`1:${ep.absoluteNumber}`, ep.seasonNumber, ep.episodeNumber);
      }
    }
  }

  const airedSeasonStats = new Map<
    number,
    { total: number; mapped: number; effSeason: number | null }
  >();
  const effMappedPositions = new Map<number, Set<number>>();
  const effSeasonVotes = new Map<number, Map<number, number>>();
  for (const ep of episodes) {
    const stat = airedSeasonStats.get(ep.seasonNumber) ?? {
      total: 0,
      mapped: 0,
      effSeason: null,
    };
    stat.total++;
    let effS: number | null = null;
    let effE: number | null = null;
    if (effective === 'dvd') {
      effS = ep.dvdSeasonNumber ?? null;
      effE = ep.dvdEpisodeNumber ?? null;
    } else if (effective === 'absolute') {
      effS = ep.absoluteNumber != null ? 1 : null;
      effE = ep.absoluteNumber ?? null;
    } else {
      effS = ep.seasonNumber;
      effE = ep.episodeNumber;
    }
    if (effS != null && effE != null) {
      stat.mapped++;
      const positions = effMappedPositions.get(effS) ?? new Set<number>();
      positions.add(effE);
      effMappedPositions.set(effS, positions);
      const votes = effSeasonVotes.get(ep.seasonNumber) ?? new Map();
      votes.set(effS, (votes.get(effS) ?? 0) + 1);
      effSeasonVotes.set(ep.seasonNumber, votes);
    }
    airedSeasonStats.set(ep.seasonNumber, stat);
  }
  for (const [aired, stat] of airedSeasonStats) {
    const votes = effSeasonVotes.get(aired);
    if (votes) {
      stat.effSeason = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
  }

  return {
    detected,
    effective,
    expectedBySeason,
    expectedNumbersBySeason,
    toAired,
    airedSeasonStats,
    effMappedPositions,
  };
};
