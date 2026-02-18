import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';

import { BotTemplateService } from './bot-template.service';
import { BotHandlersService } from './handlers/bot-handlers.service';
import { BotContextWithState } from './middleware/user-context.middleware';

type BotContext = BotContextWithState;

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private bot: Bot<BotContext> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly botTemplateService: BotTemplateService,
    private readonly botHandlersService: BotHandlersService,
  ) {}

  onModuleInit(): void {
    const token = this.configService.get<string>('BOT_TOKEN');

    if (!token) {
      throw new Error('BOT_TOKEN is not configured');
    }

    this.bot = new Bot<BotContext>(token);
    this.bot.catch((error) => {
      this.logger.error('Unhandled grammY error', error.error);
    });

    this.botHandlersService.registerHandlers(this.bot);

    this.bot
      .start({
        onStart: async () => {
          await this.bot!.api.setMyCommands([
            { command: 'start', description: 'Начать работу' },
            { command: 'help', description: 'Как использовать' },
            { command: 'history', description: 'Последние сообщения' },
          ]);

          const botUsername = this.configService.get<string>('BOT_USERNAME') ?? 'unknown';
          this.logger.log(`Telegram bot started: @${botUsername}`);

          const adminId = this.configService.get<string>('BOT_ADMIN_ID');
          if (adminId) {
            await this.bot!.api.sendMessage(adminId, this.botTemplateService.renderBotStarted(botUsername));
          }
        },
      })
      .catch((error) => {
        this.logger.error('Telegram bot failed to start', error);
      });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.bot) {
      return;
    }

    this.bot.stop();
    this.logger.log('Telegram bot stopped');
  }
}
