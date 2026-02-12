import { Module } from '@nestjs/common';

import { AnalysisModule } from '../analysis/analysis.module';
import { EntitiesModule } from '../entities/entities.module';
import { MessagesModule } from '../messages/messages.module';
import { TelegramUsersModule } from '../telegram-users/telegram-users.module';
import { BotService } from './bot.service';

@Module({
  imports: [TelegramUsersModule, MessagesModule, AnalysisModule, EntitiesModule],
  providers: [BotService],
})
export class BotModule {}
