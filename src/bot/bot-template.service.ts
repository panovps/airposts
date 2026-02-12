import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Injectable } from '@nestjs/common';
import Handlebars from 'handlebars';

import { EntityDetection, EntityType } from '../analysis/analysis.types';

const TYPE_ORDER: EntityType[] = ['person', 'organization', 'location', 'event', 'sports_club'];

const TYPE_LABELS: Record<EntityType, string> = {
  person: 'Персоны',
  organization: 'Организации',
  location: 'Локации',
  event: 'События',
  sports_club: 'Спортивные клубы',
};

interface HistoryMessage {
  index: number;
  id: string;
  preview: string;
  entityCount: number;
}

@Injectable()
export class BotTemplateService {
  private readonly templates: Record<string, Handlebars.TemplateDelegate>;

  constructor() {
    const templatesDir = join(__dirname, 'templates');
    const names = ['analysis-reply', 'analysis-pending', 'start', 'help', 'error-no-user', 'history', 'bot-started'];
    this.templates = {};
    for (const name of names) {
      this.templates[name] = Handlebars.compile(
        readFileSync(join(templatesDir, `${name}.hbs`), 'utf-8'),
        { noEscape: false },
      );
    }
  }

  private render(name: string, data: Record<string, unknown> = {}): string {
    return this.templates[name](data);
  }

  renderStart(): string {
    return this.render('start');
  }

  renderHelp(): string {
    return this.render('help');
  }

  renderErrorNoUser(): string {
    return this.render('error-no-user');
  }

  renderBotStarted(botUsername: string): string {
    return this.render('bot-started', { botUsername });
  }

  renderAnalysisPending(): string {
    return this.render('analysis-pending');
  }

  renderHistory(messages: HistoryMessage[]): string {
    if (messages.length === 0) {
      return this.render('history', { empty: true });
    }
    return this.render('history', { messages });
  }

  renderAnalysisReply(messageId: string, detections: EntityDetection[], hasText: boolean): string {
    if (!hasText) {
      return this.render('analysis-reply', { noText: true, messageId });
    }

    if (detections.length === 0) {
      return this.render('analysis-reply', { noEntities: true, messageId });
    }

    const grouped = new Map<EntityType, EntityDetection[]>();
    for (const detection of detections) {
      const list = grouped.get(detection.type) ?? [];
      list.push(detection);
      grouped.set(detection.type, list);
    }

    const groups = TYPE_ORDER.filter((type) => grouped.has(type)).map((type) => ({
      label: TYPE_LABELS[type],
      items: grouped.get(type)!.map((item) => ({
        value: item.value,
        description: item.description,
      })),
    }));

    return this.render('analysis-reply', {
      messageId,
      totalCount: detections.length,
      groups,
    });
  }
}
