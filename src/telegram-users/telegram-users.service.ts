import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'grammy/types';
import { Repository } from 'typeorm';

import { TelegramUserEntity } from './telegram-user.entity';

@Injectable()
export class TelegramUsersService {
  constructor(
    @InjectRepository(TelegramUserEntity)
    private readonly repository: Repository<TelegramUserEntity>,
  ) {}

  async upsertFromTelegramUser(user: User): Promise<TelegramUserEntity> {
    const values = {
      telegramId: String(user.id),
      username: user.username ?? null,
      firstName: user.first_name ?? null,
      lastName: user.last_name ?? null,
      languageCode: user.language_code ?? null,
      isBot: user.is_bot,
      isPremium: user.is_premium ?? null,
      lastSeenAt: new Date(),
    };

    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .into(TelegramUserEntity)
      .values(values)
      .orUpdate(
        ['username', 'firstName', 'lastName', 'languageCode', 'isBot', 'isPremium', 'lastSeenAt'],
        ['telegramId'],
      )
      .returning('*')
      .execute();

    return result.raw[0] as TelegramUserEntity;
  }
}
