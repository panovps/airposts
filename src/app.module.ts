import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BotModule } from './bot/bot.module';
import { validateEnv } from './config/env.validation';
import { buildTypeOrmOptions } from './database/typeorm.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...buildTypeOrmOptions(configService.getOrThrow<string>('DATABASE_URL')),
        autoLoadEntities: true,
      }),
    }),
    BotModule,
  ],
})
export class AppModule {}
