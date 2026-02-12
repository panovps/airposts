import { anthropic } from '@ai-sdk/anthropic';
import { deepseek } from '@ai-sdk/deepseek';
import { openai } from '@ai-sdk/openai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateObject } from 'ai';
import { z } from 'zod';

import { EntityDetection, EntityType } from './analysis.types';

const entityTypeSchema = z.enum(['person', 'organization', 'location', 'event', 'sports_club']);

const analysisResponseSchema = z.object({
  entities: z
    .array(
      z.object({
        type: entityTypeSchema,
        value: z.string().min(1).max(200),
        confidence: z.number().min(0).max(1).optional(),
        reason: z.string().max(240).nullable().optional(),
      }),
    )
    .max(40)
    .default([]),
});

type LlmProvider = 'openai' | 'anthropic' | 'deepseek';

type RawDetection = z.infer<typeof analysisResponseSchema>['entities'][number];

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(private readonly configService: ConfigService) {}

  async analyze(text: string): Promise<EntityDetection[]> {
    const source = text.trim();

    if (!source) {
      return [];
    }

    try {
      const llmDetections = await this.analyzeWithAi(source);

      if (llmDetections.length > 0) {
        return llmDetections;
      }

      this.logger.warn('LLM returned no entities, switching to fallback extraction');
      return this.analyzeWithFallback(source);
    } catch (error) {
      this.logger.warn(`LLM extraction failed, switching to fallback extraction: ${String(error)}`);
      return this.analyzeWithFallback(source);
    }
  }

  private async analyzeWithAi(source: string): Promise<EntityDetection[]> {
    const { model, provider, modelId } = this.resolveModel();

    const { object } = await generateObject({
      model,
      schema: analysisResponseSchema,
      temperature: 0,
      system: [
        'You extract named entities from a Telegram post.',
        'Return only entities that are explicitly present in the text.',
        'Allowed types: person, organization, location, event, sports_club.',
        'Do not invent entities.',
      ].join(' '),
      prompt: [
        'Extract entities from the following post.',
        'Respond using the schema only.',
        '',
        source,
      ].join('\n'),
    });

    const detections = this.normalizeDetections(source, object.entities);
    this.logger.debug(`LLM extraction finished provider=${provider} model=${modelId} entities=${detections.length}`);

    return detections;
  }

  private resolveModel(): { provider: LlmProvider; modelId: string; model: ReturnType<typeof openai> } {
    const provider = this.resolveProvider();

    if (provider === 'anthropic') {
      const modelId = this.configService.get<string>('ANTHROPIC_MODEL') ?? 'claude-3-5-haiku-latest';
      return {
        provider,
        modelId,
        model: anthropic(modelId) as ReturnType<typeof openai>,
      };
    }

    if (provider === 'deepseek') {
      const modelId = this.configService.get<string>('DEEPSEEK_MODEL') ?? 'deepseek-chat';
      return {
        provider,
        modelId,
        model: deepseek(modelId) as ReturnType<typeof openai>,
      };
    }

    const modelId = this.configService.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';
    return {
      provider: 'openai',
      modelId,
      model: openai(modelId),
    };
  }

  private resolveProvider(): LlmProvider {
    const configured = this.configService.get<string>('LLM_PROVIDER')?.toLowerCase().trim();

    if (!configured) {
      return 'openai';
    }

    if (configured === 'openai' || configured === 'anthropic' || configured === 'deepseek') {
      return configured;
    }

    this.logger.warn(`Unsupported LLM_PROVIDER="${configured}", fallback to "openai"`);
    return 'openai';
  }

  private normalizeDetections(source: string, rawEntities: RawDetection[]): EntityDetection[] {
    const detections: EntityDetection[] = [];
    const seen = new Set<string>();

    for (const rawEntity of rawEntities) {
      const value = rawEntity.value.trim();

      if (!value) {
        continue;
      }

      const normalizedValue = this.normalizeValue(value);
      const dedupeKey = `${rawEntity.type}:${normalizedValue}`;

      if (seen.has(dedupeKey)) {
        continue;
      }

      seen.add(dedupeKey);

      const { startOffset, endOffset } = this.findSpan(source, value);

      detections.push({
        type: rawEntity.type,
        value,
        normalizedValue,
        confidence: this.normalizeConfidence(rawEntity.confidence),
        startOffset,
        endOffset,
        reason: rawEntity.reason ?? 'Extracted by LLM',
      });
    }

    return detections.sort((a, b) => {
      if (a.startOffset === null && b.startOffset === null) {
        return 0;
      }

      if (a.startOffset === null) {
        return 1;
      }

      if (b.startOffset === null) {
        return -1;
      }

      return a.startOffset - b.startOffset;
    });
  }

  private analyzeWithFallback(source: string): EntityDetection[] {
    const fallbackDetections: EntityDetection[] = [];

    this.collectRegexMatches(
      source,
      /\b(?:[А-ЯЁ][а-яё]{1,30}\s+[А-ЯЁ][а-яё]{1,30}(?:\s+[А-ЯЁ][а-яё]{1,30})?|[A-Z][a-z]{1,30}\s+[A-Z][a-z]{1,30}(?:\s+[A-Z][a-z]{1,30})?)\b/g,
      'person',
      0.55,
      'Fallback: looks like a personal name.',
      fallbackDetections,
    );

    this.collectRegexMatches(
      source,
      /\b(?:ООО|АО|ПАО)\s+["«]?[\p{L}\d .-]{2,80}["»]?\b/gu,
      'organization',
      0.65,
      'Fallback: company legal form detected.',
      fallbackDetections,
    );

    this.collectRegexMatches(
      source,
      /\b(?:матч|турнир|финал|конференция|форум|презентация|релиз|запуск|match|final|conference|summit)\b/gi,
      'event',
      0.5,
      'Fallback: event keyword detected.',
      fallbackDetections,
    );

    return fallbackDetections;
  }

  private collectRegexMatches(
    source: string,
    regex: RegExp,
    type: EntityType,
    confidence: number,
    reason: string,
    detections: EntityDetection[],
  ): void {
    const seen = new Set(detections.map((item) => `${item.type}:${item.normalizedValue}`));

    for (const match of source.matchAll(regex)) {
      const value = match[0].trim();

      if (!value) {
        continue;
      }

      const normalizedValue = this.normalizeValue(value);
      const dedupeKey = `${type}:${normalizedValue}`;

      if (seen.has(dedupeKey)) {
        continue;
      }

      seen.add(dedupeKey);

      detections.push({
        type,
        value,
        normalizedValue,
        confidence,
        startOffset: match.index ?? null,
        endOffset: match.index === undefined ? null : match.index + value.length,
        reason,
      });
    }
  }

  private findSpan(source: string, value: string): { startOffset: number | null; endOffset: number | null } {
    const index = source.toLowerCase().indexOf(value.toLowerCase());

    if (index < 0) {
      return { startOffset: null, endOffset: null };
    }

    return {
      startOffset: index,
      endOffset: index + value.length,
    };
  }

  private normalizeValue(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private normalizeConfidence(confidence?: number): number {
    if (typeof confidence !== 'number' || Number.isNaN(confidence)) {
      return 0.75;
    }

    if (confidence < 0) {
      return 0;
    }

    if (confidence > 1) {
      return 1;
    }

    return confidence;
  }
}
