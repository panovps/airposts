import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TelegramUserEntity } from './telegram-user.entity';
import { TelegramUsersService } from './telegram-users.service';

@Module({
  imports: [TypeOrmModule.forFeature([TelegramUserEntity])],
  providers: [TelegramUsersService],
  exports: [TelegramUsersService],
})
export class TelegramUsersModule {}
