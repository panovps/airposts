import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { MessageEntity } from '../messages/message.entity';
import { EntityType } from '../analysis/analysis.types';

@Entity({ name: 'entities' })
@Index('idx_entities_type', ['type'])
@Index('idx_entities_normalized_value', ['normalizedValue'])
export class EntityRecordEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Index('idx_entities_message_id')
  @Column({ name: 'message_id', type: 'bigint' })
  messageId!: string;

  @ManyToOne(() => MessageEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id', foreignKeyConstraintName: 'entities_message_id_fkey' })
  message!: MessageEntity;

  @Column({ type: 'varchar', length: 32 })
  type!: EntityType;

  @Column({ type: 'text' })
  value!: string;

  @Column({ name: 'normalized_value', type: 'text' })
  normalizedValue!: string;

  @Column({ name: 'display_name', type: 'text', nullable: true })
  displayName!: string | null;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 4,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  confidence!: number;

  @Column({ name: 'start_offset', type: 'integer', nullable: true })
  startOffset!: number | null;

  @Column({ name: 'end_offset', type: 'integer', nullable: true })
  endOffset!: number | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'wiki_url', type: 'text', nullable: true })
  wikiUrl!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
