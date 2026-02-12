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
    await this.repository.delete({ messageId });

    if (detections.length === 0) {
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
      }),
    );

    return this.repository.save(entities);
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
