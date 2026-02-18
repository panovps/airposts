import { IncomingMessageType } from '../../common/types';

export interface StoreMessageDto {
  updateType: IncomingMessageType;
  telegramUserId: string;
  chatId: string;
  telegramMessageId: number;
  sourceChatId: string | null;
  sourceMessageId: number | null;
  text: string | null;
  rawPayload: Record<string, unknown>;
}
