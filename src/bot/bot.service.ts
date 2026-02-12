import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context, InlineKeyboard } from 'grammy';

import { AnalysisService } from '../analysis/analysis.service';
import { EntityDetection } from '../analysis/analysis.types';
import { EntitiesService } from '../entities/entities.service';
import { MessagesService } from '../messages/messages.service';
import { TelegramUsersService } from '../telegram-users/telegram-users.service';
import { BotTemplateService } from './bot-template.service';

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
    private readonly botTemplateService: BotTemplateService,
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

  private registerHandlers(bot: Bot<BotContext>): void {
    bot.command('start', async (ctx) => {
      if (ctx.from) {
        await this.telegramUsersService.upsertFromTelegramUser(ctx.from);
      }

      await ctx.reply(this.botTemplateService.renderStart());
    });

    bot.command('help', async (ctx) => {
      if (ctx.from) {
        await this.telegramUsersService.upsertFromTelegramUser(ctx.from);
      }

      await ctx.reply(this.botTemplateService.renderHelp());
    });

    bot.command('history', async (ctx) => {
      if (!ctx.from) {
        await ctx.reply(this.botTemplateService.renderErrorNoUser());
        return;
      }

      const telegramUser = await this.telegramUsersService.upsertFromTelegramUser(ctx.from);
      const messages = await this.messagesService.findRecentByTelegramUser(telegramUser.id, 5);
      const entities = await this.entitiesService.findByMessageIds(messages.map((item) => item.id));

      const entitiesByMessageId = new Map<string, number>();
      for (const entity of entities) {
        const currentCount = entitiesByMessageId.get(entity.messageId) ?? 0;
        entitiesByMessageId.set(entity.messageId, currentCount + 1);
      }

      const historyMessages = messages.map((message, index) => ({
        index: index + 1,
        id: message.id,
        preview: (message.text ?? '[без текста]').replace(/\s+/g, ' ').trim().slice(0, 80),
        entityCount: entitiesByMessageId.get(message.id) ?? 0,
      }));

      await ctx.reply(this.botTemplateService.renderHistory(historyMessages));
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
      const pending = await ctx.reply(this.botTemplateService.renderAnalysisPending());
      const detections = await this.analysisService.analyze(sourceText);
      await this.entitiesService.replaceForMessage(message.id, detections);
      const reply = this.buildAnalysisReply(message.id, detections, true);
      await ctx.api.editMessageText(
        pending.chat.id,
        pending.message_id,
        reply.text,
        { parse_mode: 'HTML', reply_markup: reply.keyboard },
      );
      return;
    }

    await this.entitiesService.replaceForMessage(message.id, []);
  }

  private buildAnalysisReply(
    messageId: string,
    detections: EntityDetection[],
    hasText: boolean,
  ): { text: string; keyboard?: InlineKeyboard } {
    const text = this.botTemplateService.renderAnalysisReply(messageId, detections, hasText);

    const keyboard = new InlineKeyboard();
    let hasWikiButtons = false;
    let buttonCount = 0;

    for (const detection of detections) {
      if (detection.wikiUrl) {
        keyboard.webApp(detection.value, detection.wikiUrl);
        hasWikiButtons = true;
        buttonCount++;
        if (buttonCount % 2 === 0) {
          keyboard.row();
        }
      }
    }

    return {
      text,
      keyboard: hasWikiButtons ? keyboard : undefined,
    };
  }
}
