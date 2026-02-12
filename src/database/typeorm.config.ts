import { DataSourceOptions } from 'typeorm';

import { EntityRecordEntity } from '../entities/entity-record.entity';
import { MessageEntity } from '../messages/message.entity';
import { TelegramUserEntity } from '../telegram-users/telegram-user.entity';

export function buildTypeOrmOptions(databaseUrl: string): DataSourceOptions {
  const migrationsPath = __filename.endsWith('.ts')
    ? 'src/database/migrations/*.ts'
    : 'dist/database/migrations/*.js';

  return {
    type: 'postgres',
    url: databaseUrl,
    entities: [TelegramUserEntity, MessageEntity, EntityRecordEntity],
    migrations: [migrationsPath],
    synchronize: false,
    logging: false,
  };
}
