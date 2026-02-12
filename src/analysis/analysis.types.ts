export type EntityType = 'person' | 'organization' | 'location' | 'event' | 'sports_club';

export interface EntityDetection {
  type: EntityType;
  value: string;
  normalizedValue: string;
  confidence: number;
  startOffset: number | null;
  endOffset: number | null;
  reason: string;
  description: string | null;
  wikiUrl: string | null;
}
