import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { EntityDetection } from '../analysis/analysis.types';
import { EntityRecordEntity } from './entity-record.entity';
import { EntitiesService } from './entities.service';

const mockRepository = {
  delete: jest.fn(),
  create: jest.fn((dto: Partial<EntityRecordEntity>) => dto),
  save: jest.fn((entities: Partial<EntityRecordEntity>[]) => entities),
  find: jest.fn(),
};

describe('EntitiesService', () => {
  let service: EntitiesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        EntitiesService,
        { provide: getRepositoryToken(EntityRecordEntity), useValue: mockRepository },
      ],
    }).compile();

    service = module.get(EntitiesService);
  });

  const sampleDetection: EntityDetection = {
    type: 'person',
    value: 'Иван Иванов',
    normalizedValue: 'иван иванов',
    confidence: 0.9,
    startOffset: 0,
    endOffset: 11,
    reason: 'Extracted by LLM',
    description: 'Российский политик',
    wikiUrl: 'https://ru.wikipedia.org/wiki/Иванов',
  };

  describe('replaceForMessage', () => {
    it('should delete old entities and create new ones', async () => {
      const result = await service.replaceForMessage('42', [sampleDetection]);

      expect(mockRepository.delete).toHaveBeenCalledWith({ messageId: '42' });
      expect(mockRepository.create).toHaveBeenCalledTimes(1);
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });

    it('should delete and return [] when detections are empty', async () => {
      const result = await service.replaceForMessage('42', []);

      expect(mockRepository.delete).toHaveBeenCalledWith({ messageId: '42' });
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should map all detection fields to entity', async () => {
      await service.replaceForMessage('42', [sampleDetection]);

      expect(mockRepository.create).toHaveBeenCalledWith({
        messageId: '42',
        type: 'person',
        value: 'Иван Иванов',
        normalizedValue: 'иван иванов',
        confidence: 0.9,
        startOffset: 0,
        endOffset: 11,
        reason: 'Extracted by LLM',
        description: 'Российский политик',
        wikiUrl: 'https://ru.wikipedia.org/wiki/Иванов',
      });
    });

    it('should handle detections without description and wikiUrl', async () => {
      const detection: EntityDetection = {
        ...sampleDetection,
        description: null,
        wikiUrl: null,
      };

      await service.replaceForMessage('42', [detection]);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: null,
          wikiUrl: null,
        }),
      );
    });
  });

  describe('findByMessageIds', () => {
    it('should return [] for empty messageIds array', async () => {
      const result = await service.findByMessageIds([]);

      expect(result).toEqual([]);
      expect(mockRepository.find).not.toHaveBeenCalled();
    });

    it('should query with In() for non-empty messageIds', async () => {
      const fakeEntities = [{ id: '1', messageId: '10' }];
      mockRepository.find.mockResolvedValue(fakeEntities);

      const result = await service.findByMessageIds(['10', '20']);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { messageId: expect.anything() },
        order: { createdAt: 'ASC' },
      });
      expect(result).toBe(fakeEntities);
    });
  });
});
