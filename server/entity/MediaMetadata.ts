import { DbAwareColumn, resolveDbType } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Durable, locally-owned copy of the title metadata the grid views need
 * (title/year/poster/season structure), so browsing the whole library never
 * depends on the in-memory TMDB cache surviving. Rows are hydrated and
 * refreshed by the metadata-refresh job on a tiered schedule; season-list
 * diffs are recorded in newSeasons so "a new season exists" can surface in
 * the UI until acknowledged.
 *
 * Deliberately not FK-linked to Media: metadata can exist for titles Seerr
 * has no media row for (yet), and survives media deletion.
 */
@Entity()
@Unique(['tmdbId', 'mediaType'])
class MediaMetadata {
  @PrimaryGeneratedColumn()
  public id: number;

  @Index()
  @Column()
  public tmdbId: number;

  @Column({ type: 'varchar' })
  public mediaType: 'movie' | 'tv';

  @Index()
  @Column({ nullable: true, type: 'int' })
  public tvdbId?: number | null;

  @Column({ nullable: true, type: 'varchar' })
  public imdbId?: string | null;

  @Column({ type: 'varchar', default: '' })
  public title: string;

  @Column({ type: 'varchar', default: '' })
  public originalTitle: string;

  @Column({ nullable: true, type: 'int' })
  public year?: number | null;

  @Column({ type: 'varchar', default: '' })
  public posterPath: string;

  @Column({ type: 'text', default: '' })
  public overview: string;

  /** TMDB series status (Returning Series, Ended, …) — picks the refresh tier */
  @Column({ type: 'varchar', default: '' })
  public seriesStatus: string;

  @Column({ nullable: true, type: 'varchar' })
  public lastAirDate?: string | null;

  /** movies: theatrical/digital release date — upcoming titles refresh daily */
  @Column({ nullable: true, type: 'varchar' })
  public releaseDate?: string | null;

  /** JSON: genre names, e.g. ["Action","Drama"] */
  @Column({ type: 'text', default: '[]' })
  public genres: string;

  /** movies: runtime; tv: typical episode runtime (minutes) */
  @Column({ nullable: true, type: 'int' })
  public runtime?: number | null;

  /** US certification / content rating when known (PG-13, TV-MA, …) */
  @Column({ type: 'varchar', default: '' })
  public certification: string;

  @Column({ type: 'varchar', default: '' })
  public backdropPath: string;

  /** tv: first network name */
  @Column({ type: 'varchar', default: '' })
  public network: string;

  /** JSON: [{ seasonNumber, episodeCount, airDate }] — includes season 0 */
  @Column({ type: 'text', default: '[]' })
  public seasons: string;

  /** JSON: season numbers first seen on the most recent refresh, until acknowledged */
  @Column({ type: 'text', default: '[]' })
  public newSeasons: string;

  @Column({ nullable: true, type: resolveDbType('datetime') })
  public newSeasonsDetectedAt?: Date | null;

  @Index()
  @Column({ nullable: true, type: resolveDbType('datetime') })
  public lastRefreshedAt?: Date | null;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @UpdateDateColumn({
    type: resolveDbType('datetime'),
    default: () => 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<MediaMetadata>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export default MediaMetadata;
