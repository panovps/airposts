import { Injectable, Logger } from '@nestjs/common';
import { Bot, InlineKeyboard } from 'grammy';

import { AnalysisService } from '../../analysis/analysis.service';
import { EntityDetection } from '../../analysis/analysis.types';
import {
  HISTORY_MESSAGES_LIMIT,
  MESSAGE_PREVIEW_MAX_LENGTH,
  NO_TEXT_PLACEHOLDER,
  WIKI_BUTTONS_PER_ROW,
} from '../../common/constants';
import { IncomingMessageType } from '../../common/types';
import { EntitiesService } from '../../entities/entities.service';
import { MessagesService } from '../../messages/messages.service';
import { TelegramUsersService } from '../../telegram-users/telegram-users.service';
import { BotTemplateService } from '../bot-template.service';
import { BotContextWithState, userContextMiddleware } from '../middleware/user-context.middleware';

type BotContext = BotContextWithState;

@Injectable()
export class BotHandlersService {
  private readonly logger = new Logger(BotHandlersService.name);

  constructor(
    private readonly telegramUsersService: TelegramUsersService,
    private readonly messagesService: MessagesService,
    private readonly analysisService: AnalysisService,
    private readonly entitiesService: EntitiesService,
    private readonly botTemplateService: BotTemplateService,
  ) {}

  registerHandlers(bot: Bot<BotContext>): void {
    bot.use(userContextMiddleware(this.telegramUsersService));

    bot.command('start', async (ctx) => {
      await ctx.reply(this.botTemplateService.renderStart());
    });

    bot.command('help', async (ctx) => {
      await ctx.reply(this.botTemplateService.renderHelp());
    });

    bot.command('history', async (ctx) => {
      if (!ctx.state.telegramUser) {
        await ctx.reply(this.botTemplateService.renderErrorNoUser());
        return;
      }

      const messages = await this.messagesService.findRecentWithEntityCounts(
        ctx.state.telegramUser.id,
        HISTORY_MESSAGES_LIMIT,
      );

      const historyMessages = messages.map((message, index) => ({
        index: index + 1,
        id: message.id,
        preview: (message.text ?? NO_TEXT_PLACEHOLDER)
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, MESSAGE_PREVIEW_MAX_LENGTH),
        entityCount: message.entityCount,
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
      await ctx.answerCallbackQuery();
    });
  }

  private async handleMessageUpdate(ctx: BotContext, type: IncomingMessageType): Promise<void> {
    if (!ctx.state.telegramUser) {
      this.logger.warn('Incoming update without sender was skipped');
      return;
    }

    const message = await this.messagesService.storeFromContext(ctx, type, ctx.state.telegramUser.id);

    const sourceText = message.text?.trim();

    if (type === 'message' && sourceText) {
      const pending = await ctx.reply(this.botTemplateService.renderAnalysisPending());

      try {
        const detections = await this.analysisService.analyze(sourceText);
        await this.entitiesService.replaceForMessage(message.id, detections);
        const reply = this.buildAnalysisReply(message.id, detections, true);
        await ctx.api.editMessageText(
          pending.chat.id,
          pending.message_id,
          reply.text,
          { parse_mode: 'HTML', reply_markup: reply.keyboard },
        );
      } catch (error) {
        this.logger.error('Analysis failed', error);
        await ctx.api.editMessageText(
          pending.chat.id,
          pending.message_id,
          this.botTemplateService.renderAnalysisError(),
        );
        await this.entitiesService.replaceForMessage(message.id, []);
      }
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
        if (buttonCount % WIKI_BUTTONS_PER_ROW === 0) {
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
