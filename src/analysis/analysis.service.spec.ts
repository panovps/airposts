jest.mock('node:fs', () => ({
  readFileSync: jest.fn().mockReturnValue('mock prompt content'),
}));

jest.mock('ai', () => ({
  generateObject: jest.fn(),
}));

jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn().mockReturnValue('openai-model'),
}));

jest.mock('@ai-sdk/anthropic', () => ({
  anthropic: jest.fn().mockReturnValue('anthropic-model'),
}));

jest.mock('@ai-sdk/deepseek', () => ({
  deepseek: jest.fn().mockReturnValue('deepseek-model'),
}));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { generateObject } from 'ai';

import { AnalysisService } from './analysis.service';

const mockConfigService = {
  get: jest.fn(),
};

const mockGenerateObject = generateObject as jest.MockedFunction<typeof generateObject>;

describe('AnalysisService', () => {
  let service: AnalysisService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        AnalysisService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get(AnalysisService);
  });

  describe('analyze', () => {
    it('should return [] for empty string', async () => {
      const result = await service.analyze('   ');
      expect(result).toEqual([]);
      expect(mockGenerateObject).not.toHaveBeenCalled();
    });

    it('should return LLM detections on success', async () => {
      mockGenerateObject.mockResolvedValue({
        object: {
          entities: [
            { type: 'person', value: 'John Doe', confidence: 0.95, reason: 'Name', description: 'A person', wikiUrl: null },
          ],
        },
      } as any);

      const result = await service.analyze('John Doe went to the store');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          type: 'person',
          value: 'John Doe',
          normalizedValue: 'john doe',
          confidence: 0.95,
          startOffset: 0,
          endOffset: 8,
          description: 'A person',
          wikiUrl: null,
        }),
      );
    });

    it('should fallback to regex when LLM returns empty entities', async () => {
      mockGenerateObject.mockResolvedValue({
        object: { entities: [] },
      } as any);

      const result = await service.analyze('John Smith went to the conference');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((d) => d.type === 'person')).toBe(true);
    });

    it('should fallback to regex when LLM throws', async () => {
      mockGenerateObject.mockRejectedValue(new Error('LLM error'));

      const result = await service.analyze('John Smith went to the conference');

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('deduplication', () => {
    it('should deduplicate by type + normalizedValue', async () => {
      mockGenerateObject.mockResolvedValue({
        object: {
          entities: [
            { type: 'person', value: 'John Doe', confidence: 0.9, reason: null, description: null, wikiUrl: null },
            { type: 'person', value: 'john doe', confidence: 0.8, reason: null, description: null, wikiUrl: null },
          ],
        },
      } as any);

      const result = await service.analyze('John Doe is great');

      expect(result).toHaveLength(1);
    });
  });

  describe('normalizeConfidence', () => {
    it('should default to 0.75 for undefined confidence', async () => {
      mockGenerateObject.mockResolvedValue({
        object: {
          entities: [
            { type: 'person', value: 'Test User', reason: null, description: null, wikiUrl: null },
          ],
        },
      } as any);

      const result = await service.analyze('Test User says hi');

      expect(result[0].confidence).toBe(0.75);
    });

    it('should clamp confidence < 0 to 0', async () => {
      mockGenerateObject.mockResolvedValue({
        object: {
          entities: [
            { type: 'person', value: 'Test User', confidence: -0.5, reason: null, description: null, wikiUrl: null },
          ],
        },
      } as any);

      const result = await service.analyze('Test User says hi');

      expect(result[0].confidence).toBe(0);
    });

    it('should clamp confidence > 1 to 1', async () => {
      mockGenerateObject.mockResolvedValue({
        object: {
          entities: [
            { type: 'person', value: 'Test User', confidence: 5.0, reason: null, description: null, wikiUrl: null },
          ],
        },
      } as any);

      const result = await service.analyze('Test User says hi');

      expect(result[0].confidence).toBe(1);
    });
  });

  describe('findSpan', () => {
    it('should find span case-insensitively', async () => {
      mockGenerateObject.mockResolvedValue({
        object: {
          entities: [
            { type: 'person', value: 'john', confidence: 0.9, reason: null, description: null, wikiUrl: null },
          ],
        },
      } as any);

      const result = await service.analyze('Hello John world');

      expect(result[0].startOffset).toBe(6);
      expect(result[0].endOffset).toBe(10);
    });

    it('should return null offsets when value not found in source', async () => {
      mockGenerateObject.mockResolvedValue({
        object: {
          entities: [
            { type: 'person', value: 'Ghost Entity', confidence: 0.9, reason: null, description: null, wikiUrl: null },
          ],
        },
      } as any);

      const result = await service.analyze('No matching text here');

      expect(result[0].startOffset).toBeNull();
      expect(result[0].endOffset).toBeNull();
    });
  });

  describe('resolveProvider / resolveModel', () => {
    it('should default to openai when LLM_PROVIDER is unset', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      mockGenerateObject.mockResolvedValue({ object: { entities: [] } } as any);

      await service.analyze('test');

      const { openai } = jest.requireMock('@ai-sdk/openai');
      expect(openai).toHaveBeenCalled();
    });

    it('should use anthropic when configured', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'LLM_PROVIDER') return 'anthropic';
        if (key === 'ANTHROPIC_MODEL') return 'claude-test';
        return undefined;
      });
      mockGenerateObject.mockResolvedValue({ object: { entities: [] } } as any);

      await service.analyze('test');

      const { anthropic } = jest.requireMock('@ai-sdk/anthropic');
      expect(anthropic).toHaveBeenCalledWith('claude-test');
    });

    it('should use deepseek when configured', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'LLM_PROVIDER') return 'deepseek';
        if (key === 'DEEPSEEK_MODEL') return 'deepseek-test';
        return undefined;
      });
      mockGenerateObject.mockResolvedValue({ object: { entities: [] } } as any);

      await service.analyze('test');

      const { deepseek } = jest.requireMock('@ai-sdk/deepseek');
      expect(deepseek).toHaveBeenCalledWith('deepseek-test');
    });

    it('should fallback to openai for unknown provider', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'LLM_PROVIDER') return 'unknown-provider';
        return undefined;
      });
      mockGenerateObject.mockResolvedValue({ object: { entities: [] } } as any);

      await service.analyze('test');

      const { openai } = jest.requireMock('@ai-sdk/openai');
      expect(openai).toHaveBeenCalled();
    });
  });

  describe('fallback regex', () => {
    beforeEach(() => {
      mockGenerateObject.mockRejectedValue(new Error('fail'));
    });

    it('should detect Latin person names', async () => {
      const result = await service.analyze('Author: John Smith');

      expect(result.some((d) => d.type === 'person' && d.value === 'John Smith')).toBe(true);
    });

    it('should not detect Cyrillic names (\\b does not work with non-ASCII)', async () => {
      const result = await service.analyze('Автор: Пётр Петров');

      expect(result.filter((d) => d.type === 'person')).toHaveLength(0);
    });

    it('should detect Latin event keywords', async () => {
      const result = await service.analyze('Tomorrow is the conference');

      expect(result.some((d) => d.type === 'event' && d.value === 'conference')).toBe(true);
    });

    it('should have description=null and wikiUrl=null for fallback detections', async () => {
      const result = await service.analyze('John Smith attended the conference');

      expect(result.length).toBeGreaterThan(0);
      for (const detection of result) {
        expect(detection.description).toBeNull();
        expect(detection.wikiUrl).toBeNull();
      }
    });
  });

  describe('description and wikiUrl mapping', () => {
    it('should pass through description and wikiUrl from LLM', async () => {
      mockGenerateObject.mockResolvedValue({
        object: {
          entities: [
            {
              type: 'person',
              value: 'Elon Musk',
              confidence: 0.99,
              reason: 'Famous person',
              description: 'CEO of SpaceX',
              wikiUrl: 'https://en.wikipedia.org/wiki/Elon_Musk',
            },
          ],
        },
      } as any);

      const result = await service.analyze('Elon Musk tweeted');

      expect(result[0].description).toBe('CEO of SpaceX');
      expect(result[0].wikiUrl).toBe('https://en.wikipedia.org/wiki/Elon_Musk');
    });

    it('should default description and wikiUrl to null when not provided', async () => {
      mockGenerateObject.mockResolvedValue({
        object: {
          entities: [
            { type: 'person', value: 'Someone', confidence: 0.8, reason: null },
          ],
        },
      } as any);

      const result = await service.analyze('Someone did something');

      expect(result[0].description).toBeNull();
      expect(result[0].wikiUrl).toBeNull();
    });
  });
});
