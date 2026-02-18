import { Module } from '@nestjs/common';

import { AnalysisModule } from '../analysis/analysis.module';
import { EntitiesModule } from '../entities/entities.module';
import { MessagesModule } from '../messages/messages.module';
import { TelegramUsersModule } from '../telegram-users/telegram-users.module';
import { BotTemplateService } from './bot-template.service';
import { BotService } from './bot.service';
import { BotHandlersService } from './handlers/bot-handlers.service';

@Module({
  imports: [TelegramUsersModule, MessagesModule, AnalysisModule, EntitiesModule],
  providers: [BotTemplateService, BotHandlersService, BotService],
})
export class BotModule {}
