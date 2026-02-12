const commandHandlers = new Map<string, (...args: any[]) => any>();
const onHandlers = new Map<string, (...args: any[]) => any>();

jest.mock('grammy', () => ({
  Bot: jest.fn().mockImplementation(() => ({
    command: jest.fn((name: string, handler: any) => {
      commandHandlers.set(name, handler);
    }),
    on: jest.fn((event: string, handler: any) => {
      onHandlers.set(event, handler);
    }),
    catch: jest.fn(),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
  })),
}));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { BotService } from './bot.service';
import { TelegramUsersService } from '../telegram-users/telegram-users.service';
import { MessagesService } from '../messages/messages.service';
import { AnalysisService } from '../analysis/analysis.service';
import { EntitiesService } from '../entities/entities.service';
import { EntityDetection } from '../analysis/analysis.types';

const mockConfigService = { get: jest.fn() };
const mockTelegramUsersService = { upsertFromTelegramUser: jest.fn() };
const mockMessagesService = { storeFromContext: jest.fn(), findRecentByTelegramUser: jest.fn() };
const mockAnalysisService = { analyze: jest.fn() };
const mockEntitiesService = { replaceForMessage: jest.fn(), findByMessageIds: jest.fn() };

describe('BotService', () => {
  let service: BotService;

  beforeEach(async () => {
    jest.clearAllMocks();
    commandHandlers.clear();
    onHandlers.clear();

    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'BOT_TOKEN') return 'test-token';
      return undefined;
    });

    const module = await Test.createTestingModule({
      providers: [
        BotService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TelegramUsersService, useValue: mockTelegramUsersService },
        { provide: MessagesService, useValue: mockMessagesService },
        { provide: AnalysisService, useValue: mockAnalysisService },
        { provide: EntitiesService, useValue: mockEntitiesService },
      ],
    }).compile();

    service = module.get(BotService);
  });

  describe('onModuleInit', () => {
    it('should throw when BOT_TOKEN is missing', () => {
      mockConfigService.get.mockReturnValue(undefined);

      expect(() => service.onModuleInit()).toThrow('BOT_TOKEN is not configured');
    });

    it('should register handlers when token is present', () => {
      service.onModuleInit();

      expect(commandHandlers.has('start')).toBe(true);
      expect(commandHandlers.has('help')).toBe(true);
      expect(commandHandlers.has('history')).toBe(true);
      expect(onHandlers.has('message')).toBe(true);
      expect(onHandlers.has('edited_message')).toBe(true);
      expect(onHandlers.has('callback_query:data')).toBe(true);
    });
  });

  describe('onModuleDestroy', () => {
    it('should stop bot when initialized', async () => {
      service.onModuleInit();
      const { Bot } = jest.requireMock('grammy');
      const botInstance = Bot.mock.results[0].value;

      await service.onModuleDestroy();

      expect(botInstance.stop).toHaveBeenCalled();
    });

    it('should not throw when bot is null', async () => {
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  describe('/start command', () => {
    it('should upsert user and reply', async () => {
      service.onModuleInit();
      const handler = commandHandlers.get('start')!;
      mockTelegramUsersService.upsertFromTelegramUser.mockResolvedValue({ id: '1' });

      const ctx = {
        from: { id: 123, is_bot: false, first_name: 'Test' },
        reply: jest.fn().mockResolvedValue(undefined),
      };

      await handler(ctx);

      expect(mockTelegramUsersService.upsertFromTelegramUser).toHaveBeenCalledWith(ctx.from);
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Пришлите репост'));
    });
  });

  describe('/help command', () => {
    it('should upsert user and reply with help', async () => {
      service.onModuleInit();
      const handler = commandHandlers.get('help')!;
      mockTelegramUsersService.upsertFromTelegramUser.mockResolvedValue({ id: '1' });

      const ctx = {
        from: { id: 123, is_bot: false, first_name: 'Test' },
        reply: jest.fn().mockResolvedValue(undefined),
      };

      await handler(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Как использовать'));
    });
  });

  describe('/history command', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should reply with empty history message', async () => {
      mockTelegramUsersService.upsertFromTelegramUser.mockResolvedValue({ id: '1' });
      mockMessagesService.findRecentByTelegramUser.mockResolvedValue([]);
      mockEntitiesService.findByMessageIds.mockResolvedValue([]);

      const ctx = {
        from: { id: 123, is_bot: false, first_name: 'Test' },
        reply: jest.fn().mockResolvedValue(undefined),
      };

      await commandHandlers.get('history')!(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('История пуста'));
    });

    it('should format message list with entity counts', async () => {
      mockTelegramUsersService.upsertFromTelegramUser.mockResolvedValue({ id: '1' });
      mockMessagesService.findRecentByTelegramUser.mockResolvedValue([
        { id: '10', text: 'First message' },
        { id: '20', text: 'Second message' },
      ]);
      mockEntitiesService.findByMessageIds.mockResolvedValue([
        { messageId: '10' },
        { messageId: '10' },
        { messageId: '20' },
      ]);

      const ctx = {
        from: { id: 123, is_bot: false, first_name: 'Test' },
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
      mockTelegramUsersService.upsertFromTelegramUser.mockResolvedValue({ id: '1' });
      mockMessagesService.findRecentByTelegramUser.mockResolvedValue([
        { id: '10', text: longText },
      ]);
      mockEntitiesService.findByMessageIds.mockResolvedValue([]);

      const ctx = {
        from: { id: 123, is_bot: false, first_name: 'Test' },
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
      service.onModuleInit();
    });

    it('should analyze text, edit placeholder with results', async () => {
      mockTelegramUsersService.upsertFromTelegramUser.mockResolvedValue({ id: '1' });
      mockMessagesService.storeFromContext.mockResolvedValue({ id: '42', text: 'Hello world' });

      const detections: EntityDetection[] = [
        {
          type: 'person',
          value: 'John',
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
        from: { id: 123, is_bot: false, first_name: 'Test' },
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
        { parse_mode: 'HTML' },
      );
    });

    it('should skip reply for message without text', async () => {
      mockTelegramUsersService.upsertFromTelegramUser.mockResolvedValue({ id: '1' });
      mockMessagesService.storeFromContext.mockResolvedValue({ id: '42', text: null });
      mockEntitiesService.replaceForMessage.mockResolvedValue([]);

      const ctx = {
        from: { id: 123, is_bot: false, first_name: 'Test' },
        reply: jest.fn(),
        api: { editMessageText: jest.fn() },
      };

      await onHandlers.get('message')!(ctx);

      expect(mockEntitiesService.replaceForMessage).toHaveBeenCalledWith('42', []);
      expect(ctx.reply).not.toHaveBeenCalled();
      expect(mockAnalysisService.analyze).not.toHaveBeenCalled();
    });

    it('should skip when ctx.from is missing', async () => {
      const ctx = {
        from: undefined,
        reply: jest.fn(),
      };

      await onHandlers.get('message')!(ctx);

      expect(mockTelegramUsersService.upsertFromTelegramUser).not.toHaveBeenCalled();
    });
  });

  describe('buildAnalysisReply', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should group detections by type with wiki links and description', async () => {
      mockTelegramUsersService.upsertFromTelegramUser.mockResolvedValue({ id: '1' });
      mockMessagesService.storeFromContext.mockResolvedValue({ id: '42', text: 'Elon Musk at SpaceX' });

      const detections: EntityDetection[] = [
        {
          type: 'person',
          value: 'Elon Musk',
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
        from: { id: 123, is_bot: false, first_name: 'Test' },
        reply: jest.fn().mockResolvedValue({ chat: { id: 100 }, message_id: 99 }),
        api: { editMessageText: jest.fn() },
      };

      await onHandlers.get('message')!(ctx);

      const replyText = ctx.api.editMessageText.mock.calls[0][2] as string;
      expect(replyText).toContain('<b>Персоны:</b>');
      expect(replyText).toContain('Elon Musk');
      expect(replyText).toContain('<a href="https://en.wikipedia.org/wiki/Elon_Musk">wiki</a>');
      expect(replyText).toContain('<i>CEO of SpaceX</i>');
      expect(replyText).toContain('<b>Организации:</b>');
      expect(replyText).toContain('SpaceX');
      expect(replyText).toContain('Найдено сущностей: 2');
    });

    it('should escape HTML in values', async () => {
      mockTelegramUsersService.upsertFromTelegramUser.mockResolvedValue({ id: '1' });
      mockMessagesService.storeFromContext.mockResolvedValue({ id: '42', text: '<b>Test</b>' });

      const detections: EntityDetection[] = [
        {
          type: 'person',
          value: '<script>alert(1)</script>',
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
        from: { id: 123, is_bot: false, first_name: 'Test' },
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
    it('should upsert user and answer callback query', async () => {
      service.onModuleInit();
      mockTelegramUsersService.upsertFromTelegramUser.mockResolvedValue({ id: '1' });

      const ctx = {
        from: { id: 123, is_bot: false, first_name: 'Test' },
        answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      };

      await onHandlers.get('callback_query:data')!(ctx);

      expect(mockTelegramUsersService.upsertFromTelegramUser).toHaveBeenCalledWith(ctx.from);
      expect(ctx.answerCallbackQuery).toHaveBeenCalled();
    });
  });
});
