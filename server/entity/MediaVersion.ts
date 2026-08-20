import { DbAwareColumn, resolveDbType } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/**
 * A Jellyfin entry ("version") of a title — the user keeps deliberate
 * duplicates like "Andromeda (2000)" + "Andromeda (2000) - 1080p", scraped
 * to the same provider ids with distinguishing titles. Scan-owned and
 * rebuildable: rows are written by the Jellyfin scanner, never by the user.
 * The main version (no " - suffix") drives media status; the others carry
 * their own completion tallies for display. User data (source logs) refers
 * to versions by LABEL TEXT only — never by id — so rescans can never
 * cascade into the vault.
 */
@Entity()
@Unique(['tmdbId', 'mediaType', 'jellyfinItemId'])
class MediaVersion {
  @PrimaryGeneratedColumn()
  public id: number;

  @Index()
  @Column()
  public tmdbId: number;

  @Column({ type: 'varchar' })
  public mediaType: 'movie' | 'tv';

  @Column({ type: 'varchar' })
  public jellyfinItemId: string;

  /** the Jellyfin entry's full display title */
  @Column({ type: 'varchar', default: '' })
  public title: string;

  /** version label parsed from the title suffix ('' = the main version) */
  @Column({ type: 'varchar', default: '' })
  public label: string;

  @Column({ type: 'boolean', default: false })
  public isMain: boolean;

  /** tv: JSON [{seasonNumber, covered, total}] in aired currency; movies: [] */
  @Column({ type: 'text', default: '[]' })
  public coverage: string;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @Column({ nullable: true, type: resolveDbType('datetime') })
  public lastSeenAt?: Date | null;

  constructor(init?: Partial<MediaVersion>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export default MediaVersion;
