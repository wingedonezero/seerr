import { DbAwareColumn, resolveDbType } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import MediaSource from './MediaSource';

/** A named text log attached to a source — MakeMKV output, rip notes, etc. */
@Entity()
class SourceLog {
  @PrimaryGeneratedColumn()
  public id: number;

  @Index()
  @ManyToOne(() => MediaSource, (source) => source.logs, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  public source: MediaSource;

  @Column({ type: 'varchar', default: '' })
  public title: string;

  @Column({ type: 'text', default: '' })
  public body: string;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @UpdateDateColumn({
    type: resolveDbType('datetime'),
    default: () => 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<SourceLog>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export default SourceLog;
