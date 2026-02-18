import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { EntityRecordEntity } from '../entities/entity-record.entity';
import { TelegramUserEntity } from '../telegram-users/telegram-user.entity';

@Entity({ name: 'messages' })
@Index('idx_messages_chat_message', ['chatId', 'telegramMessageId'])
@Index('idx_messages_user_created', ['telegramUserId', 'createdAt'])
export class MessageEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Index('idx_messages_telegram_user_id')
  @Column({ name: 'telegram_user_id', type: 'bigint' })
  telegramUserId!: string;

  @ManyToOne(() => TelegramUserEntity, { nullable: false, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'telegram_user_id', foreignKeyConstraintName: 'messages_telegram_user_id_fkey' })
  telegramUser!: TelegramUserEntity;

  @OneToMany(() => EntityRecordEntity, (entity) => entity.message)
  entities!: EntityRecordEntity[];

  @Column({ name: 'update_type', type: 'varchar', length: 32 })
  updateType!: 'message' | 'edited_message';

  @Column({ name: 'chat_id', type: 'bigint' })
  chatId!: string;

  @Column({ name: 'telegram_message_id', type: 'integer' })
  telegramMessageId!: number;

  @Column({ name: 'source_chat_id', type: 'bigint', nullable: true })
  sourceChatId!: string | null;

  @Column({ name: 'source_message_id', type: 'integer', nullable: true })
  sourceMessageId!: number | null;

  @Column({ type: 'text', nullable: true })
  text!: string | null;

  @Column({ name: 'raw_payload', type: 'jsonb' })
  rawPayload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
