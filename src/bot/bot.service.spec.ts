const commandHandlers = new Map<string, (...args: any[]) => any>();
const onHandlers = new Map<string, (...args: any[]) => any>();

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
    InlineKeyboard: MockInlineKeyboard,
  };
});

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { BotService } from './bot.service';
import { BotTemplateService } from './bot-template.service';
import { BotHandlersService } from './handlers/bot-handlers.service';

const mockConfigService = { get: jest.fn() };
const mockBotHandlersService = { registerHandlers: jest.fn() };

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
        BotTemplateService,
        BotService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: BotHandlersService, useValue: mockBotHandlersService },
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

      expect(mockBotHandlersService.registerHandlers).toHaveBeenCalled();
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
});
