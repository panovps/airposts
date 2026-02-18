import { Context } from 'grammy';

import { TelegramUserEntity } from '../../telegram-users/telegram-user.entity';
import { TelegramUsersService } from '../../telegram-users/telegram-users.service';

export interface BotContextWithState extends Context {
  state: {
    telegramUser?: TelegramUserEntity;
  };
}

export function userContextMiddleware(telegramUsersService: TelegramUsersService) {
  return async (ctx: BotContextWithState, next: () => Promise<void>) => {
    if (ctx.from) {
      ctx.state = ctx.state || {};
      ctx.state.telegramUser = await telegramUsersService.upsertFromTelegramUser(ctx.from);
    }
    await next();
  };
}
