import type { anthropic } from '@ai-sdk/anthropic';
import type { deepseek } from '@ai-sdk/deepseek';
import type { openai } from '@ai-sdk/openai';

export type EntityType = 'person' | 'organization' | 'location' | 'event' | 'sports_club';

export type LlmModel = ReturnType<typeof openai> | ReturnType<typeof anthropic> | ReturnType<typeof deepseek>;

export interface EntityDetection {
  type: EntityType;
  value: string;
  displayName: string;
  normalizedValue: string;
  confidence: number;
  startOffset: number | null;
  endOffset: number | null;
  reason: string;
  description: string | null;
  wikiUrl: string | null;
}
