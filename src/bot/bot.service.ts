import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context } from 'grammy';

import { AnalysisService } from '../analysis/analysis.service';
import { EntityDetection, EntityType } from '../analysis/analysis.types';
import { EntitiesService } from '../entities/entities.service';
import { MessagesService } from '../messages/messages.service';
import { TelegramUsersService } from '../telegram-users/telegram-users.service';

type BotContext = Context;
type IncomingMessageType = 'message' | 'edited_message';

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private bot: Bot<BotContext> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly telegramUsersService: TelegramUsersService,
    private readonly messagesService: MessagesService,
    private readonly analysisService: AnalysisService,
    private readonly entitiesService: EntitiesService,
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

    this.registerHandlers(this.bot);

    this.bot
      .start({
        onStart: (botInfo) => {
          this.logger.log(`Telegram bot started: @${botInfo.username}`);
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

  private registerHandlers(bot: Bot<BotContext>): void {
    bot.command('start', async (ctx) => {
      if (ctx.from) {
        await this.telegramUsersService.upsertFromTelegramUser(ctx.from);
      }

      await ctx.reply(
        [
          'Пришлите репост или сообщение с текстом.',
          'Я сохраню его, извлеку сущности и покажу карточки по категориям.',
          'Команды: /help, /history',
        ].join('\n'),
      );
    });

    bot.command('help', async (ctx) => {
      if (ctx.from) {
        await this.telegramUsersService.upsertFromTelegramUser(ctx.from);
      }

      await ctx.reply(
        [
          'Как использовать:',
          '1) Перешлите пост в бота.',
          '2) Бот выделит: person, organization, location, event, sports_club.',
          '3) Список последних сообщений: /history',
        ].join('\n'),
      );
    });

    bot.command('history', async (ctx) => {
      if (!ctx.from) {
        await ctx.reply('Не удалось определить пользователя.');
        return;
      }

      const telegramUser = await this.telegramUsersService.upsertFromTelegramUser(ctx.from);
      const messages = await this.messagesService.findRecentByTelegramUser(telegramUser.id, 5);
      const entities = await this.entitiesService.findByMessageIds(messages.map((item) => item.id));

      if (messages.length === 0) {
        await ctx.reply('История пуста. Отправьте или перешлите сообщение для анализа.');
        return;
      }

      const entitiesByMessageId = new Map<string, number>();
      for (const entity of entities) {
        const currentCount = entitiesByMessageId.get(entity.messageId) ?? 0;
        entitiesByMessageId.set(entity.messageId, currentCount + 1);
      }

      const lines = messages.map((message, index) => {
        const preview = (message.text ?? '[без текста]').replace(/\s+/g, ' ').trim().slice(0, 80);
        const count = entitiesByMessageId.get(message.id) ?? 0;
        return `${index + 1}. #${message.id} | ${preview} | сущностей: ${count}`;
      });

      await ctx.reply(['Последние сообщения:', ...lines].join('\n'));
    });

    bot.on('message', async (ctx) => {
      await this.handleMessageUpdate(ctx, 'message');
    });

    bot.on('edited_message', async (ctx) => {
      await this.handleMessageUpdate(ctx, 'edited_message');
    });

    bot.on('callback_query:data', async (ctx) => {
      if (ctx.from) {
        await this.telegramUsersService.upsertFromTelegramUser(ctx.from);
      }

      await ctx.answerCallbackQuery();
    });
  }

  private async handleMessageUpdate(ctx: BotContext, type: IncomingMessageType): Promise<void> {
    if (!ctx.from) {
      this.logger.warn('Incoming update without sender was skipped');
      return;
    }

    const telegramUser = await this.telegramUsersService.upsertFromTelegramUser(ctx.from);
    const message = await this.messagesService.storeFromContext(ctx, type, telegramUser.id);

    const sourceText = message.text?.trim();

    if (type === 'message' && sourceText) {
      const pending = await ctx.reply('Анализирую сообщение…');
      const detections = await this.analysisService.analyze(sourceText);
      await this.entitiesService.replaceForMessage(message.id, detections);
      await ctx.api.editMessageText(
        pending.chat.id,
        pending.message_id,
        this.buildAnalysisReply(message.id, detections, true),
        { parse_mode: 'HTML' },
      );
      return;
    }

    await this.entitiesService.replaceForMessage(message.id, []);
  }

  private buildAnalysisReply(messageId: string, detections: EntityDetection[], hasText: boolean): string {
    if (!hasText) {
      return `Сообщение #${messageId} сохранено. Текст не найден, анализ пропущен.`;
    }

    if (detections.length === 0) {
      return `Сообщение #${messageId} сохранено. Сущности не обнаружены.`;
    }

    const typeOrder: EntityType[] = ['person', 'organization', 'location', 'event', 'sports_club'];
    const labels: Record<EntityType, string> = {
      person: 'Персоны',
      organization: 'Организации',
      location: 'Локации',
      event: 'События',
      sports_club: 'Спортивные клубы',
    };

    const grouped = new Map<EntityType, EntityDetection[]>();

    for (const detection of detections) {
      const list = grouped.get(detection.type) ?? [];
      list.push(detection);
      grouped.set(detection.type, list);
    }

    const lines: string[] = [`Сообщение #${messageId} проанализировано. Найдено сущностей: ${detections.length}`];

    for (const type of typeOrder) {
      const items = grouped.get(type);

      if (!items || items.length === 0) {
        continue;
      }

      lines.push(`\n<b>${labels[type]}:</b>`);
      for (const item of items) {
        const name = this.escapeHtml(item.value);
        const wiki = item.wikiUrl ? ` [<a href="${this.escapeHtml(item.wikiUrl)}">wiki</a>]` : '';
        const desc = item.description ? `\n  <i>${this.escapeHtml(item.description)}</i>` : '';
        lines.push(`- ${name}${wiki}${desc}`);
      }
    }

    return lines.join('\n');
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
