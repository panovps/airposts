import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'telegram_users' })
@Unique('telegram_users_telegram_id_key', ['telegramId'])
export class TelegramUserEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'telegram_id', type: 'bigint' })
  telegramId!: string;

  @Column({ type: 'text', nullable: true })
  username!: string | null;

  @Column({ name: 'first_name', type: 'text', nullable: true })
  firstName!: string | null;

  @Column({ name: 'last_name', type: 'text', nullable: true })
  lastName!: string | null;

  @Column({ name: 'language_code', type: 'text', nullable: true })
  languageCode!: string | null;

  @Column({ name: 'is_bot', type: 'boolean', default: false })
  isBot!: boolean;

  @Column({ name: 'is_premium', type: 'boolean', nullable: true })
  isPremium!: boolean | null;

  @Column({ name: 'first_seen_at', type: 'timestamptz', default: () => 'now()' })
  firstSeenAt!: Date;

  @Index('idx_telegram_users_last_seen_at')
  @Column({ name: 'last_seen_at', type: 'timestamptz', default: () => 'now()' })
  lastSeenAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
