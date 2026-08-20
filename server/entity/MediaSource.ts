import { DbAwareColumn, resolveDbType } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import SourceLog from './SourceLog';

/**
 * A physical/release source for a title: a disc (the common case), remux or
 * encode. TV sources anchor to a season (seasonNumber; 0 = Specials, null =
 * whole title / movie) — unlimited sources per season, unlimited logs per
 * source.
 *
 * User-authored and irreplaceable: keyed by (tmdbId, mediaType) with no FK
 * into any scanned table, so rescans and media deletions can never cascade
 * into this data. Only SourceLog cascades from here (a log belongs to its
 * source by definition).
 */
@Entity()
@Index(['tmdbId', 'mediaType'])
class MediaSource {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public tmdbId: number;

  @Column({ type: 'varchar' })
  public mediaType: 'movie' | 'tv';

  @Column({ nullable: true, type: 'int' })
  public seasonNumber?: number | null;

  /** disc | remux | encode */
  @Column({ type: 'varchar' })
  public kind: string;

  @Column({ type: 'varchar', default: '' })
  public name: string;

  /** release group — used for remux/encode sources, usually blank for discs */
  @Column({ type: 'varchar', default: '' })
  public grp: string;

  /**
   * which library version this source belongs to, by LABEL TEXT (e.g.
   * '1080p', '480p', '' = main) — deliberately not a foreign key: version
   * rows are scan-owned and rebuildable, and nothing may cascade into
   * user-authored data.
   */
  @Column({ type: 'varchar', default: '' })
  public versionLabel: string;

  /** free text: disc label/size/protection, BDInfo dump, release notes… */
  @Column({ type: 'text', default: '' })
  public info: string;

  @OneToMany(() => SourceLog, (log) => log.source)
  public logs: SourceLog[];

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @UpdateDateColumn({
    type: resolveDbType('datetime'),
    default: () => 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<MediaSource>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export default MediaSource;
