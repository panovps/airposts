import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { anthropic } from '@ai-sdk/anthropic';
import { deepseek } from '@ai-sdk/deepseek';
import { openai } from '@ai-sdk/openai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateObject } from 'ai';
import { z } from 'zod';

import { EntityDetection, LlmModel } from './analysis.types';

const entityTypeSchema = z.enum(['person', 'organization', 'location', 'event', 'sports_club']);

const analysisResponseSchema = z.object({
  entities: z
    .array(
      z.object({
        type: entityTypeSchema,
        value: z.string().min(1).max(200),
        displayName: z.string().min(1).max(200).nullable(),
        confidence: z.number().min(0).max(1).nullable(),
        reason: z.string().max(240).nullable(),
        description: z.string().max(500).nullable(),
        // Do not use `.url()` here: OpenAI response JSON schema rejects `format: "uri"` in strict mode.
        wikiUrl: z.string().max(500).nullable(),
      }),
    )
    .max(40),
});

type LlmProvider = 'openai' | 'anthropic' | 'deepseek';

type RawDetection = z.infer<typeof analysisResponseSchema>['entities'][number];

const PROMPTS_DIR = join(__dirname, 'prompts');
const systemPrompt = readFileSync(join(PROMPTS_DIR, 'system.md'), 'utf-8').trim();
const userPromptTemplate = readFileSync(join(PROMPTS_DIR, 'user.md'), 'utf-8').trim();

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(private readonly configService: ConfigService) {}

  async analyze(text: string): Promise<EntityDetection[]> {
    const source = text.trim();

    if (!source) {
      return [];
    }

    return this.analyzeWithAi(source);
  }

  private async analyzeWithAi(source: string): Promise<EntityDetection[]> {
    const { model, provider, modelId } = this.resolveModel();

    const { object } = await generateObject({
      model,
      schema: analysisResponseSchema,
      temperature: 0,
      system: systemPrompt,
      prompt: userPromptTemplate.replace('{{source}}', source),
    });

    const detections = this.normalizeDetections(source, object.entities);
    this.logger.debug(`LLM extraction finished provider=${provider} model=${modelId} entities=${detections.length}`);

    return detections;
  }

  private resolveModel(): { provider: LlmProvider; modelId: string; model: LlmModel } {
    const provider = this.resolveProvider();

    if (provider === 'anthropic') {
      const modelId = this.configService.get<string>('ANTHROPIC_MODEL') ?? 'claude-3-5-haiku-latest';
      return {
        provider,
        modelId,
        model: anthropic(modelId),
      };
    }

    if (provider === 'deepseek') {
      const modelId = this.configService.get<string>('DEEPSEEK_MODEL') ?? 'deepseek-chat';
      return {
        provider,
        modelId,
        model: deepseek(modelId),
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
        displayName: rawEntity.displayName?.trim() || value,
        normalizedValue,
        confidence: this.normalizeConfidence(rawEntity.confidence),
        startOffset,
        endOffset,
        reason: rawEntity.reason ?? 'Extracted by LLM',
        description: rawEntity.description ?? null,
        wikiUrl: this.normalizeWikiUrl(rawEntity.wikiUrl),
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

  private normalizeConfidence(confidence: number | null): number {
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

  private normalizeWikiUrl(wikiUrl: string | null): string | null {
    if (typeof wikiUrl !== 'string') {
      return null;
    }

    const value = wikiUrl.trim();
    if (!value) {
      return null;
    }

    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }

      return parsed.toString();
    } catch {
      return null;
    }
  }
}
