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
  name: string;
}

export interface OrderAssessment {
  /** '' when nothing could be detected */
  detected: string;
  /** override ?? detected ?? aired */
  effective: 'aired' | 'dvd' | 'absolute';
  /** expected episode count per season in the effective ordering */
  expectedBySeason: Map<number, number>;
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

  const expectedBySeason = new Map<number, number>();
  if (effective === 'dvd') {
    for (const ep of episodes) {
      if (ep.dvdSeasonNumber != null) {
        expectedBySeason.set(
          ep.dvdSeasonNumber,
          (expectedBySeason.get(ep.dvdSeasonNumber) ?? 0) + 1
        );
      }
    }
  } else if (effective === 'absolute') {
    expectedBySeason.set(
      1,
      episodes.filter((e) => e.absoluteNumber != null).length
    );
  } else {
    for (const ep of episodes) {
      expectedBySeason.set(
        ep.seasonNumber,
        (expectedBySeason.get(ep.seasonNumber) ?? 0) + 1
      );
    }
  }

  return { detected, effective, expectedBySeason };
};
