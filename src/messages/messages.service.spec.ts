import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { MessageEntity } from './message.entity';
import { MessagesService } from './messages.service';

const mockRepository = {
  create: jest.fn((dto: Partial<MessageEntity>) => dto),
  save: jest.fn((entity: Partial<MessageEntity>) => ({ id: '1', ...entity })),
  find: jest.fn(),
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
});
