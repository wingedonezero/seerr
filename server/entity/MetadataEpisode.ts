import { DbAwareColumn, resolveDbType } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import MediaMetadata from './MediaMetadata';

/**
 * Durable per-episode metadata for titles in the library/requests — episode
 * titles, air dates and overviews render locally (and survive provider
 * outages or deletions). Rows are keyed by the AIRED numbering, which is
 * canonical everywhere; the dvd/absolute columns are filled by the
 * order-awareness feature (TVDB season types) so alternate orderings map
 * onto the same rows rather than duplicating them.
 */
@Entity()
@Unique(['metadata', 'seasonNumber', 'episodeNumber'])
class MetadataEpisode {
  @PrimaryGeneratedColumn()
  public id: number;

  @Index()
  @ManyToOne(() => MediaMetadata, { onDelete: 'CASCADE', nullable: false })
  public metadata: MediaMetadata;

  @Column()
  public seasonNumber: number;

  @Column()
  public episodeNumber: number;

  @Column({ nullable: true, type: 'int' })
  public absoluteNumber?: number | null;

  @Column({ nullable: true, type: 'int' })
  public dvdSeasonNumber?: number | null;

  @Column({ nullable: true, type: 'int' })
  public dvdEpisodeNumber?: number | null;

  @Column({ type: 'varchar', default: '' })
  public title: string;

  @Column({ nullable: true, type: 'varchar' })
  public airDate?: string | null;

  @Column({ type: 'text', default: '' })
  public overview: string;

  @Column({ nullable: true, type: 'int' })
  public runtime?: number | null;

  /** episode id at the active metadata provider — used for order mapping */
  @Column({ nullable: true, type: 'int' })
  public providerEpisodeId?: number | null;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @UpdateDateColumn({
    type: resolveDbType('datetime'),
    default: () => 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<MetadataEpisode>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export default MetadataEpisode;
