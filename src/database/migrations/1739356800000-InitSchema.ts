import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1739356800000 implements MigrationInterface {
  name = 'InitSchema1739356800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS telegram_users (
        id bigserial PRIMARY KEY,
        telegram_id bigint NOT NULL UNIQUE,
        username text,
        first_name text,
        last_name text,
        language_code text,
        is_bot boolean NOT NULL DEFAULT false,
        is_premium boolean,
        first_seen_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_telegram_users_last_seen_at ON telegram_users(last_seen_at);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id bigserial PRIMARY KEY,
        telegram_user_id bigint NOT NULL REFERENCES telegram_users(id),
        update_type varchar(32) NOT NULL,
        chat_id bigint NOT NULL,
        telegram_message_id integer NOT NULL,
        source_chat_id bigint,
        source_message_id integer,
        text text,
        raw_payload jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_telegram_user_id ON messages(telegram_user_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_chat_message ON messages(chat_id, telegram_message_id);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS entities (
        id bigserial PRIMARY KEY,
        message_id bigint NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        type varchar(32) NOT NULL,
        value text NOT NULL,
        normalized_value text NOT NULL,
        confidence numeric(5, 4) NOT NULL,
        start_offset integer,
        end_offset integer,
        reason text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_entities_message_id ON entities(message_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_entities_normalized_value ON entities(normalized_value);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS entities;');
    await queryRunner.query('DROP TABLE IF EXISTS messages;');
    await queryRunner.query('DROP TABLE IF EXISTS telegram_users;');
  }
}
