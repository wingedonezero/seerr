import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/**
 * User-authored marks on a title — 'downloading' (actively grabbing; cleared
 * automatically when the title reaches the library) and 'tobuy' (shopping
 * list; manual clear only). Flag names are plain data, so future kinds cost
 * no schema change.
 *
 * Deliberately keyed by (tmdbId, mediaType) with no FK into scanned tables:
 * user data must survive media deletion and rescans untouched.
 */
@Entity()
@Unique(['tmdbId', 'mediaType', 'flag'])
class MediaFlag {
  @PrimaryGeneratedColumn()
  public id: number;

  @Index()
  @Column()
  public tmdbId: number;

  @Column({ type: 'varchar' })
  public mediaType: 'movie' | 'tv';

  @Column({ type: 'varchar' })
  public flag: string;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  constructor(init?: Partial<MediaFlag>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export default MediaFlag;
