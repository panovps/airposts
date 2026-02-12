import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EntityRecordEntity } from './entity-record.entity';
import { EntitiesService } from './entities.service';

@Module({
  imports: [TypeOrmModule.forFeature([EntityRecordEntity])],
  providers: [EntitiesService],
  exports: [EntitiesService],
})
export class EntitiesModule {}
