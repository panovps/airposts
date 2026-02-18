import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { StoreMessageDto } from './dto/store-message.dto';
import { MessageEntity } from './message.entity';
import { MessagesService } from './messages.service';

const mockQueryBuilder = {
  leftJoin: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  getRawAndEntities: jest.fn(),
};

const mockRepository = {
  create: jest.fn((dto: Partial<MessageEntity>) => dto),
  save: jest.fn((entity: Partial<MessageEntity>) => ({ id: '1', ...entity })),
  find: jest.fn(),
  createQueryBuilder: jest.fn(() => mockQueryBuilder),
};

describe('MessagesService', () => {
  let service: MessagesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: getRepositoryToken(MessageEntity), useValue: mockRepository },
      ],
    }).compile();

    service = module.get(MessagesService);
  });

  const baseMessage = {
    chat: { id: 100 },
    message_id: 42,
    date: 1700000000,
  };

  describe('storeMessage', () => {
    it('should create and save entity from DTO', async () => {
      const dto: StoreMessageDto = {
        updateType: 'message',
        telegramUserId: '10',
        chatId: '100',
        telegramMessageId: 42,
        sourceChatId: '555',
        sourceMessageId: 99,
        text: 'Test message',
        rawPayload: { test: 'data' },
      };

      await service.storeMessage(dto);

      expect(mockRepository.create).toHaveBeenCalledWith(dto);
      expect(mockRepository.save).toHaveBeenCalledWith(dto);
    });

    it('should handle null optional fields', async () => {
      const dto: StoreMessageDto = {
        updateType: 'message',
        telegramUserId: '10',
        chatId: '100',
        telegramMessageId: 42,
        sourceChatId: null,
        sourceMessageId: null,
        text: null,
        rawPayload: {},
      };

      await service.storeMessage(dto);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceChatId: null,
          sourceMessageId: null,
          text: null,
        }),
      );
    });
  });

  describe('storeFromContext – pickMessage', () => {
    it('should use ctx.message for "message" updateType', async () => {
      const ctx = {
        message: { ...baseMessage, text: 'hello' },
        editedMessage: undefined,
      } as any;

      await service.storeFromContext(ctx, 'message', '10');

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          updateType: 'message',
          chatId: '100',
          telegramMessageId: 42,
          text: 'hello',
        }),
      );
    });

    it('should use ctx.editedMessage for "edited_message" updateType', async () => {
      const ctx = {
        message: undefined,
        editedMessage: { ...baseMessage, text: 'edited' },
      } as any;

      await service.storeFromContext(ctx, 'edited_message', '10');

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          updateType: 'edited_message',
          text: 'edited',
        }),
      );
    });

    it('should throw when payload is absent', async () => {
      const ctx = { message: undefined, editedMessage: undefined } as any;

      await expect(service.storeFromContext(ctx, 'message', '10')).rejects.toThrow(
        'Unsupported update payload for message',
      );
    });
  });

  describe('extractText', () => {
    it('should extract text from message.text', async () => {
      const ctx = { message: { ...baseMessage, text: 'text content' } } as any;

      await service.storeFromContext(ctx, 'message', '10');

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'text content' }),
      );
    });

    it('should extract text from message.caption', async () => {
      const ctx = { message: { ...baseMessage, caption: 'caption content' } } as any;

      await service.storeFromContext(ctx, 'message', '10');

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'caption content' }),
      );
    });

    it('should return null when no text or caption', async () => {
      const ctx = { message: { ...baseMessage } } as any;

      await service.storeFromContext(ctx, 'message', '10');

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ text: null }),
      );
    });
  });

  describe('extractForwardMeta', () => {
    it('should extract legacy forward_from_chat', async () => {
      const ctx = {
        message: {
          ...baseMessage,
          text: 'forwarded',
          forward_from_chat: { id: 555 },
          forward_from_message_id: 99,
        },
      } as any;

      await service.storeFromContext(ctx, 'message', '10');

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceChatId: '555',
          sourceMessageId: 99,
        }),
      );
    });

    it('should extract new forward_origin with chat', async () => {
      const ctx = {
        message: {
          ...baseMessage,
          text: 'forwarded',
          forward_origin: { type: 'channel', chat: { id: 777 }, message_id: 88 },
        },
      } as any;

      await service.storeFromContext(ctx, 'message', '10');

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceChatId: '777',
          sourceMessageId: 88,
        }),
      );
    });

    it('should extract forward_origin with sender_chat', async () => {
      const ctx = {
        message: {
          ...baseMessage,
          text: 'forwarded',
          forward_origin: { type: 'chat', sender_chat: { id: 333 }, message_id: 77 },
        },
      } as any;

      await service.storeFromContext(ctx, 'message', '10');

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceChatId: '333',
          sourceMessageId: 77,
        }),
      );
    });

    it('should return nulls when no forward data', async () => {
      const ctx = { message: { ...baseMessage, text: 'regular' } } as any;

      await service.storeFromContext(ctx, 'message', '10');

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceChatId: null,
          sourceMessageId: null,
        }),
      );
    });
  });

  describe('findRecentByTelegramUser', () => {
    it('should find messages ordered by createdAt DESC with default limit 10', async () => {
      const mockMessages = [
        { id: '1', text: 'Message 1', createdAt: new Date('2024-01-02') },
        { id: '2', text: 'Message 2', createdAt: new Date('2024-01-01') },
      ];
      mockRepository.find.mockResolvedValue(mockMessages);

      const result = await service.findRecentByTelegramUser('123');

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { telegramUserId: '123' },
        order: { createdAt: 'DESC' },
        take: 10,
      });
      expect(result).toEqual(mockMessages);
    });

    it('should use custom limit when provided', async () => {
      mockRepository.find.mockResolvedValue([]);

      await service.findRecentByTelegramUser('123', 5);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { telegramUserId: '123' },
        order: { createdAt: 'DESC' },
        take: 5,
      });
    });
  });

  describe('findRecentWithEntityCounts', () => {
    it('should fetch messages with entity counts using JOIN', async () => {
      const mockEntities = [
        { id: '1', text: 'Message 1' },
        { id: '2', text: 'Message 2' },
      ];
      const mockRaw = [{ entityCount: '2' }, { entityCount: '0' }];

      mockQueryBuilder.getRawAndEntities.mockResolvedValue({
        entities: mockEntities,
        raw: mockRaw,
      });

      const result = await service.findRecentWithEntityCounts('123', 5);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('message');
      expect(mockQueryBuilder.leftJoin).toHaveBeenCalledWith('message.entities', 'entity');
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith('COUNT(entity.id)', 'entityCount');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('message.telegramUserId = :telegramUserId', { telegramUserId: '123' });
      expect(mockQueryBuilder.groupBy).toHaveBeenCalledWith('message.id');
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('message.createdAt', 'DESC');
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(5);

      expect(result).toEqual([
        { id: '1', text: 'Message 1', entityCount: 2 },
        { id: '2', text: 'Message 2', entityCount: 0 },
      ]);
    });

    it('should use default limit of 10', async () => {
      mockQueryBuilder.getRawAndEntities.mockResolvedValue({
        entities: [],
        raw: [],
      });

      await service.findRecentWithEntityCounts('123');

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
    });

    it('should convert entityCount to number', async () => {
      const mockEntities = [{ id: '1', text: 'Message' }];
      const mockRaw = [{ entityCount: '42' }];

      mockQueryBuilder.getRawAndEntities.mockResolvedValue({
        entities: mockEntities,
        raw: mockRaw,
      });

      const result = await service.findRecentWithEntityCounts('123');

      expect(result[0].entityCount).toBe(42);
      expect(typeof result[0].entityCount).toBe('number');
    });

    it('should handle null entityCount as 0', async () => {
      const mockEntities = [{ id: '1', text: 'Message' }];
      const mockRaw = [{ entityCount: null }];

      mockQueryBuilder.getRawAndEntities.mockResolvedValue({
        entities: mockEntities,
        raw: mockRaw,
      });

      const result = await service.findRecentWithEntityCounts('123');

      expect(result[0].entityCount).toBe(0);
    });
  });
});
