import { getRepository } from '@server/datasource';
import MediaMetadata from '@server/entity/MediaMetadata';
import MediaVersion from '@server/entity/MediaVersion';

/**
 * Version bookkeeping for deliberate Jellyfin duplicates (see MediaVersion).
 *
 * The user's tmm convention distinguishes versions by title suffix:
 * "Frankenfish (2004)" is the main copy, "Frankenfish (2004) - 480p" a
 * version labeled 480p. A " - suffix" only counts as a version label when
 * the part before it matches the canonical title (so titles that naturally
 * contain " - " aren't mangled).
 */

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const parseVersionLabel = (
  entryTitle: string,
  canonicalTitle: string,
  year?: number | null
): string => {
  const idx = entryTitle.lastIndexOf(' - ');
  if (idx === -1) {
    return '';
  }
  const base = normalize(entryTitle.slice(0, idx));
  const canonicals = [
    normalize(canonicalTitle),
    year ? normalize(`${canonicalTitle} ${year}`) : '',
  ].filter(Boolean);
  if (canonicals.includes(base)) {
    return entryTitle.slice(idx + 3).trim();
  }
  return '';
};

export interface VersionCoverage {
  seasonNumber: number;
  covered: number;
  total: number;
}

/**
 * Record/refresh this Jellyfin entry as a version row. Returns true when
 * this entry should drive media status: it's the main version, or no main
 * version exists anywhere for the title.
 */
export const recordVersion = async ({
  tmdbId,
  mediaType,
  jellyfinItemId,
  entryTitle,
  canonicalTitle,
  year,
  coverage,
}: {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  jellyfinItemId: string;
  entryTitle: string;
  canonicalTitle: string;
  year?: number | null;
  coverage: VersionCoverage[];
}): Promise<boolean> => {
  const repo = getRepository(MediaVersion);
  let label = parseVersionLabel(entryTitle, canonicalTitle, year);
  if (label === '' && entryTitle.includes(' - ')) {
    // Jellyfin doesn't always return an original title (movies especially) —
    // retry against our own durable metadata title before concluding "main".
    const meta = await getRepository(MediaMetadata).findOne({
      where: { tmdbId, mediaType },
    });
    if (meta?.title) {
      label = parseVersionLabel(entryTitle, meta.title, meta.year ?? year);
    }
  }
  const isMain = label === '';

  const existing = await repo.findOne({
    where: { tmdbId, mediaType, jellyfinItemId },
  });
  const row =
    existing ??
    new MediaVersion({ tmdbId, mediaType, jellyfinItemId });
  row.title = entryTitle;
  row.label = label;
  row.isMain = isMain;
  row.coverage = JSON.stringify(coverage);
  row.lastSeenAt = new Date();
  await repo.save(row);

  if (isMain) {
    return true;
  }
  const main = await repo.findOne({
    where: { tmdbId, mediaType, isMain: true },
  });
  // a non-main entry only drives status when no main copy exists at all
  return !main || main.jellyfinItemId === jellyfinItemId;
};
