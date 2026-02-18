import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Context } from 'grammy';
import { Message } from 'grammy/types';
import { Repository } from 'typeorm';

import { IncomingMessageType } from '../common/types';
import { StoreMessageDto } from './dto/store-message.dto';
import { MessageEntity } from './message.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(MessageEntity)
    private readonly repository: Repository<MessageEntity>,
  ) {}

  async storeMessage(dto: StoreMessageDto): Promise<MessageEntity> {
    const entity = this.repository.create(dto);
    return this.repository.save(entity);
  }

  async storeFromContext(ctx: Context, updateType: IncomingMessageType, telegramUserId: string): Promise<MessageEntity> {
    const message = this.pickMessage(ctx, updateType);

    if (!message) {
      throw new Error(`Unsupported update payload for ${updateType}`);
    }

    const forwardMeta = this.extractForwardMeta(message);

    const dto: StoreMessageDto = {
      telegramUserId,
      updateType,
      chatId: String(message.chat.id),
      telegramMessageId: message.message_id,
      sourceChatId: forwardMeta.sourceChatId,
      sourceMessageId: forwardMeta.sourceMessageId,
      text: this.extractText(message),
      rawPayload: message as unknown as Record<string, unknown>,
    };

    return this.storeMessage(dto);
  }

  async findRecentByTelegramUser(telegramUserId: string, limit = 10): Promise<MessageEntity[]> {
    return this.repository.find({
      where: { telegramUserId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findRecentWithEntityCounts(
    telegramUserId: string,
    limit = 10,
  ): Promise<Array<MessageEntity & { entityCount: number }>> {
    const results = await this.repository
      .createQueryBuilder('message')
      .leftJoin('message.entities', 'entity')
      .select([
        'message.id',
        'message.text',
        'message.createdAt',
        'message.updateType',
        'message.chatId',
        'message.telegramMessageId',
      ])
      .addSelect('COUNT(entity.id)', 'entityCount')
      .where('message.telegramUserId = :telegramUserId', { telegramUserId })
      .groupBy('message.id')
      .orderBy('message.createdAt', 'DESC')
      .limit(limit)
      .getRawAndEntities();

    return results.entities.map((message, index) => ({
      ...message,
      entityCount: Number(results.raw[index].entityCount) || 0,
    }));
  }

  private pickMessage(ctx: Context, updateType: IncomingMessageType): Message | undefined {
    if (updateType === 'message') {
      return ctx.message;
    }

    return ctx.editedMessage;
  }

  private extractText(message: Message): string | null {
    if ('text' in message && typeof message.text === 'string') {
      return message.text;
    }

    if ('caption' in message && typeof message.caption === 'string') {
      return message.caption;
    }

    return null;
  }

  private extractForwardMeta(message: Message): { sourceChatId: string | null; sourceMessageId: number | null } {
    const legacyForwardChat = (message as Message & { forward_from_chat?: { id: number } }).forward_from_chat;
    const legacyForwardMessageId = (message as Message & { forward_from_message_id?: number }).forward_from_message_id;

    if (legacyForwardChat?.id) {
      return {
        sourceChatId: String(legacyForwardChat.id),
        sourceMessageId: legacyForwardMessageId ?? null,
      };
    }

    const forwardOrigin = (message as Message & { forward_origin?: unknown }).forward_origin;

    if (!forwardOrigin || typeof forwardOrigin !== 'object') {
      return { sourceChatId: null, sourceMessageId: null };
    }

    const origin = forwardOrigin as {
      type?: string;
      chat?: { id?: number | string };
      sender_chat?: { id?: number | string };
      message_id?: number;
    };

    const sourceChatId = origin.chat?.id ?? origin.sender_chat?.id;

    return {
      sourceChatId: sourceChatId ? String(sourceChatId) : null,
      sourceMessageId: origin.message_id ?? null,
    };
  }
}
