import { Injectable, Logger } from '@nestjs/common';
import { Bot, InlineKeyboard } from 'grammy';

import { AnalysisService } from '../../analysis/analysis.service';
import { EntityDetection } from '../../analysis/analysis.types';
import {
  DRAFT_THROTTLE_MS,
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
      const chatId = ctx.chat!.id;
      const draftId = ctx.msg!.message_id;

      try {
        const pendingText = this.botTemplateService.renderAnalysisPending();
        await (ctx.api as any).sendMessageDraft(chatId, draftId, pendingText).catch(() => {});

        const stream = this.analysisService.analyzeStream(sourceText);
        const finalObjectPromise = stream.object;
        // Stream of partial chunks can fail before final object is awaited.
        // Attach a sink catch to prevent unhandled rejection in that branch.
        void finalObjectPromise.catch(() => undefined);

        let lastDraftTime = 0;
        let lastEntityCount = 0;

        for await (const partial of stream.partialObjectStream) {
          const entities = partial.entities ?? [];
          const completeEntities = entities.filter(
            (e) => e != null && typeof e.type === 'string' && typeof e.value === 'string',
          );

          if (completeEntities.length > lastEntityCount) {
            const now = Date.now();
            if (now - lastDraftTime >= DRAFT_THROTTLE_MS) {
              lastEntityCount = completeEntities.length;
              lastDraftTime = now;

              const draftDetections: EntityDetection[] = completeEntities.map((e) => ({
                type: e!.type as EntityDetection['type'],
                value: e!.value!,
                displayName: e!.displayName?.trim() || e!.value!,
                normalizedValue: e!.value!.toLowerCase(),
                confidence: 0,
                startOffset: null,
                endOffset: null,
                reason: '',
                description: e!.description ?? null,
                wikiUrl: null,
              }));

              const draftText = this.botTemplateService.renderAnalysisReply(message.id, draftDetections, true, true);

              try {
                await (ctx.api as any).sendMessageDraft(chatId, draftId, draftText, { parse_mode: 'HTML' });
              } catch {
                // Draft API may not be available, continue silently
              }
            }
          }
        }

        const finalObj = await finalObjectPromise;
        const detections = finalObj.entities;

        await this.entitiesService.replaceForMessage(message.id, detections);
        const reply = this.buildAnalysisReply(message.id, detections, true);
        await ctx.reply(reply.text, { parse_mode: 'HTML', reply_markup: reply.keyboard });
      } catch (error) {
        this.logger.error('Analysis failed', error);
        await ctx.reply(this.botTemplateService.renderAnalysisError());
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
        keyboard.webApp(detection.displayName, detection.wikiUrl);
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
