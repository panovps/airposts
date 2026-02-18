import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { EntityDetection } from '../analysis/analysis.types';
import { EntityRecordEntity } from './entity-record.entity';

@Injectable()
export class EntitiesService {
  constructor(
    @InjectRepository(EntityRecordEntity)
    private readonly repository: Repository<EntityRecordEntity>,
  ) {}

  async replaceForMessage(messageId: string, detections: EntityDetection[]): Promise<EntityRecordEntity[]> {
    const queryRunner = this.repository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.delete(EntityRecordEntity, { messageId });

      if (detections.length === 0) {
        await queryRunner.commitTransaction();
        return [];
      }

      const entities = detections.map((detection) =>
        this.repository.create({
          messageId,
          type: detection.type,
          value: detection.value,
          normalizedValue: detection.normalizedValue,
          confidence: detection.confidence,
          startOffset: detection.startOffset,
          endOffset: detection.endOffset,
          reason: detection.reason,
          description: detection.description,
          wikiUrl: detection.wikiUrl,
        }),
      );

      const saved = await queryRunner.manager.save(entities);
      await queryRunner.commitTransaction();
      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findByMessageIds(messageIds: string[]): Promise<EntityRecordEntity[]> {
    if (messageIds.length === 0) {
      return [];
    }

    return this.repository.find({
      where: { messageId: In(messageIds) },
      order: { createdAt: 'ASC' },
    });
  }
}
