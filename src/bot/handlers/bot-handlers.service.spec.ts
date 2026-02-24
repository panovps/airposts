const commandHandlers = new Map<string, (...args: any[]) => any>();
const onHandlers = new Map<string, (...args: any[]) => any>();
const middlewares: any[] = [];

jest.mock('grammy', () => {
  class MockInlineKeyboard {
    private buttons: Record<string, any>[][] = [];
    private currentRow: Record<string, any>[] = [];

    url(text: string, urlValue: string) {
      this.currentRow.push({ text, url: urlValue });
      return this;
    }

    webApp(text: string, urlValue: string) {
      this.currentRow.push({ text, web_app: { url: urlValue } });
      return this;
    }

    row() {
      if (this.currentRow.length > 0) {
        this.buttons.push(this.currentRow);
        this.currentRow = [];
      }
      return this;
    }
  }

  return {
    Bot: jest.fn().mockImplementation(() => ({
      use: jest.fn((middleware: any) => {
        middlewares.push(middleware);
      }),
      command: jest.fn((name: string, handler: any) => {
        commandHandlers.set(name, handler);
      }),
      on: jest.fn((event: string, handler: any) => {
        onHandlers.set(event, handler);
      }),
    })),
    InlineKeyboard: MockInlineKeyboard,
  };
});

import { Test } from '@nestjs/testing';

import { BotHandlersService } from './bot-handlers.service';
import { BotTemplateService } from '../bot-template.service';
import { TelegramUsersService } from '../../telegram-users/telegram-users.service';
import { MessagesService } from '../../messages/messages.service';
import { AnalysisService } from '../../analysis/analysis.service';
import { EntitiesService } from '../../entities/entities.service';
import { EntityDetection } from '../../analysis/analysis.types';
import { Bot } from 'grammy';
import { BotContextWithState } from '../middleware/user-context.middleware';

const mockTelegramUsersService = { upsertFromTelegramUser: jest.fn() };
const mockMessagesService = {
  storeFromContext: jest.fn(),
  findRecentByTelegramUser: jest.fn(),
  findRecentWithEntityCounts: jest.fn(),
};
const mockAnalysisService = { analyze: jest.fn() };
const mockEntitiesService = { replaceForMessage: jest.fn(), findByMessageIds: jest.fn() };

describe('BotHandlersService', () => {
  let service: BotHandlersService;
  let bot: Bot<BotContextWithState>;
  let templateService: BotTemplateService;

  beforeEach(async () => {
    jest.clearAllMocks();
    commandHandlers.clear();
    onHandlers.clear();
    middlewares.length = 0;

    const module = await Test.createTestingModule({
      providers: [
        BotTemplateService,
        BotHandlersService,
        { provide: TelegramUsersService, useValue: mockTelegramUsersService },
        { provide: MessagesService, useValue: mockMessagesService },
        { provide: AnalysisService, useValue: mockAnalysisService },
        { provide: EntitiesService, useValue: mockEntitiesService },
      ],
    }).compile();

    templateService = module.get(BotTemplateService);
    await templateService.onModuleInit();
    service = module.get(BotHandlersService);
    bot = new Bot<BotContextWithState>('test-token');
  });

  describe('registerHandlers', () => {
    it('should register middleware and all command and event handlers', () => {
      service.registerHandlers(bot);

      expect(middlewares.length).toBe(1);
      expect(commandHandlers.has('start')).toBe(true);
      expect(commandHandlers.has('help')).toBe(true);
      expect(commandHandlers.has('history')).toBe(true);
      expect(onHandlers.has('message')).toBe(true);
      expect(onHandlers.has('edited_message')).toBe(true);
      expect(onHandlers.has('callback_query:data')).toBe(true);
    });
  });

  describe('/start command', () => {
    it('should reply with start message', async () => {
      service.registerHandlers(bot);
      const handler = commandHandlers.get('start')!;

      const ctx = {
        state: { telegramUser: { id: '1' } },
        reply: jest.fn().mockResolvedValue(undefined),
      };

      await handler(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Пришлите репост'));
    });
  });

  describe('/help command', () => {
    it('should reply with help message', async () => {
      service.registerHandlers(bot);
      const handler = commandHandlers.get('help')!;

      const ctx = {
        state: { telegramUser: { id: '1' } },
        reply: jest.fn().mockResolvedValue(undefined),
      };

      await handler(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Как использовать'));
    });
  });

  describe('/history command', () => {
    beforeEach(() => {
      service.registerHandlers(bot);
    });

    it('should reply with empty history message', async () => {
      mockMessagesService.findRecentWithEntityCounts.mockResolvedValue([]);

      const ctx = {
        state: { telegramUser: { id: '1' } },
        reply: jest.fn().mockResolvedValue(undefined),
      };

      await commandHandlers.get('history')!(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('История пуста'));
    });

    it('should format message list with entity counts', async () => {
      mockMessagesService.findRecentWithEntityCounts.mockResolvedValue([
        { id: '10', text: 'First message', entityCount: 2 },
        { id: '20', text: 'Second message', entityCount: 1 },
      ]);

      const ctx = {
        state: { telegramUser: { id: '1' } },
        reply: jest.fn().mockResolvedValue(undefined),
      };

      await commandHandlers.get('history')!(ctx);

      const reply = ctx.reply.mock.calls[0][0] as string;
      expect(reply).toContain('Последние сообщения:');
      expect(reply).toContain('#10');
      expect(reply).toContain('сущностей: 2');
      expect(reply).toContain('#20');
      expect(reply).toContain('сущностей: 1');
    });

    it('should truncate text to 80 characters', async () => {
      const longText = 'A'.repeat(150);
      mockMessagesService.findRecentWithEntityCounts.mockResolvedValue([
        { id: '10', text: longText, entityCount: 0 },
      ]);

      const ctx = {
        state: { telegramUser: { id: '1' } },
        reply: jest.fn().mockResolvedValue(undefined),
      };

      await commandHandlers.get('history')!(ctx);

      const reply = ctx.reply.mock.calls[0][0] as string;
      const line = reply.split('\n').find((l: string) => l.includes('#10'))!;
      expect(line.includes('A'.repeat(80))).toBe(true);
      expect(line.includes('A'.repeat(81))).toBe(false);
    });
  });

  describe('message handler', () => {
    beforeEach(() => {
      service.registerHandlers(bot);
    });

    it('should analyze text, edit placeholder with results', async () => {
      mockMessagesService.storeFromContext.mockResolvedValue({ id: '42', text: 'Hello world' });

      const detections: EntityDetection[] = [
        {
          type: 'person',
          value: 'John',
          displayName: 'John',
          normalizedValue: 'john',
          confidence: 0.9,
          startOffset: 0,
          endOffset: 4,
          reason: 'Name',
          description: null,
          wikiUrl: null,
        },
      ];
      mockAnalysisService.analyze.mockResolvedValue(detections);
      mockEntitiesService.replaceForMessage.mockResolvedValue([]);

      const ctx = {
        state: { telegramUser: { id: '1' } },
        reply: jest.fn().mockResolvedValue({ chat: { id: 100 }, message_id: 99 }),
        api: {
          editMessageText: jest.fn().mockResolvedValue(undefined),
        },
      };

      await onHandlers.get('message')!(ctx);

      expect(ctx.reply).toHaveBeenCalledWith('Анализирую сообщение…');
      expect(mockAnalysisService.analyze).toHaveBeenCalledWith('Hello world');
      expect(mockEntitiesService.replaceForMessage).toHaveBeenCalledWith('42', detections);
      expect(ctx.api.editMessageText).toHaveBeenCalledWith(
        100,
        99,
        expect.any(String),
        expect.objectContaining({ parse_mode: 'HTML' }),
      );
    });

    it('should skip reply for message without text', async () => {
      mockMessagesService.storeFromContext.mockResolvedValue({ id: '42', text: null });
      mockEntitiesService.replaceForMessage.mockResolvedValue([]);

      const ctx = {
        state: { telegramUser: { id: '1' } },
        reply: jest.fn(),
        api: { editMessageText: jest.fn() },
      };

      await onHandlers.get('message')!(ctx);

      expect(mockEntitiesService.replaceForMessage).toHaveBeenCalledWith('42', []);
      expect(ctx.reply).not.toHaveBeenCalled();
      expect(mockAnalysisService.analyze).not.toHaveBeenCalled();
    });

    it('should skip when telegramUser is missing from state', async () => {
      const ctx = {
        state: {},
        reply: jest.fn(),
      };

      await onHandlers.get('message')!(ctx);

      expect(mockMessagesService.storeFromContext).not.toHaveBeenCalled();
    });

    it('should handle LLM failure and clean up pending message', async () => {
      mockMessagesService.storeFromContext.mockResolvedValue({ id: '42', text: 'Hello world' });
      mockAnalysisService.analyze.mockRejectedValue(new Error('LLM timeout'));
      mockEntitiesService.replaceForMessage.mockResolvedValue([]);

      const ctx = {
        state: { telegramUser: { id: '1' } },
        reply: jest.fn().mockResolvedValue({ chat: { id: 100 }, message_id: 99 }),
        api: {
          editMessageText: jest.fn().mockResolvedValue(undefined),
        },
      };

      await onHandlers.get('message')!(ctx);

      expect(ctx.reply).toHaveBeenCalledWith('Анализирую сообщение…');
      expect(mockAnalysisService.analyze).toHaveBeenCalledWith('Hello world');
      expect(ctx.api.editMessageText).toHaveBeenCalledWith(
        100,
        99,
        'Не удалось проанализировать сообщение. Попробуйте позже.\n',
      );
      expect(mockEntitiesService.replaceForMessage).toHaveBeenCalledWith('42', []);
    });
  });

  describe('buildAnalysisReply', () => {
    beforeEach(() => {
      service.registerHandlers(bot);
    });

    it('should group detections by type with wiki links and description', async () => {
      mockMessagesService.storeFromContext.mockResolvedValue({ id: '42', text: 'Elon Musk at SpaceX' });

      const detections: EntityDetection[] = [
        {
          type: 'person',
          value: 'Elon Musk',
          displayName: 'Elon Musk',
          normalizedValue: 'elon musk',
          confidence: 0.99,
          startOffset: 0,
          endOffset: 9,
          reason: 'Name',
          description: 'CEO of SpaceX',
          wikiUrl: 'https://en.wikipedia.org/wiki/Elon_Musk',
        },
        {
          type: 'organization',
          value: 'SpaceX',
          displayName: 'SpaceX',
          normalizedValue: 'spacex',
          confidence: 0.95,
          startOffset: 13,
          endOffset: 19,
          reason: 'Org',
          description: null,
          wikiUrl: null,
        },
      ];
      mockAnalysisService.analyze.mockResolvedValue(detections);
      mockEntitiesService.replaceForMessage.mockResolvedValue([]);

      const ctx = {
        state: { telegramUser: { id: '1' } },
        reply: jest.fn().mockResolvedValue({ chat: { id: 100 }, message_id: 99 }),
        api: { editMessageText: jest.fn() },
      };

      await onHandlers.get('message')!(ctx);

      const replyText = ctx.api.editMessageText.mock.calls[0][2] as string;
      expect(replyText).toContain('<b>Персоны:</b>');
      expect(replyText).toContain('Elon Musk');
      expect(replyText).toContain('<blockquote expandable>CEO of SpaceX</blockquote>');
      expect(replyText).toContain('<b>Организации:</b>');
      expect(replyText).toContain('SpaceX');
      expect(replyText).toContain('Найдено сущностей: 2');
      expect(replyText).not.toContain('<a href=');

      const options = ctx.api.editMessageText.mock.calls[0][3];
      expect(options.reply_markup).toBeDefined();
    });

    it('should escape HTML in values', async () => {
      mockTelegramUsersService.upsertFromTelegramUser.mockResolvedValue({ id: '1' });
      mockMessagesService.storeFromContext.mockResolvedValue({ id: '42', text: '<b>Test</b>' });

      const detections: EntityDetection[] = [
        {
          type: 'person',
          value: '<script>alert(1)</script>',
          displayName: '<script>alert(1)</script>',
          normalizedValue: '<script>alert(1)</script>',
          confidence: 0.9,
          startOffset: null,
          endOffset: null,
          reason: 'test',
          description: null,
          wikiUrl: null,
        },
      ];
      mockAnalysisService.analyze.mockResolvedValue(detections);
      mockEntitiesService.replaceForMessage.mockResolvedValue([]);

      const ctx = {
        state: { telegramUser: { id: '1' } },
        reply: jest.fn().mockResolvedValue({ chat: { id: 100 }, message_id: 99 }),
        api: { editMessageText: jest.fn() },
      };

      await onHandlers.get('message')!(ctx);

      const replyText = ctx.api.editMessageText.mock.calls[0][2] as string;
      expect(replyText).toContain('&lt;script&gt;');
      expect(replyText).not.toContain('<script>');
    });
  });

  describe('callback_query:data handler', () => {
    it('should answer callback query', async () => {
      service.registerHandlers(bot);

      const ctx = {
        state: { telegramUser: { id: '1' } },
        answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      };

      await onHandlers.get('callback_query:data')!(ctx);

      expect(ctx.answerCallbackQuery).toHaveBeenCalled();
    });
  });
});
