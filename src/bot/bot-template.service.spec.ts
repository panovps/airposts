import { BotTemplateService } from './bot-template.service';
import { EntityDetection } from '../analysis/analysis.types';

describe('BotTemplateService', () => {
  let service: BotTemplateService;

  beforeEach(async () => {
    service = new BotTemplateService();
    await service.onModuleInit();
  });

  describe('renderStart', () => {
    it('should render start message', () => {
      const result = service.renderStart();
      expect(result).toContain('Пришлите репост');
    });
  });

  describe('renderHelp', () => {
    it('should render help message', () => {
      const result = service.renderHelp();
      expect(result).toContain('Как использовать');
    });
  });

  describe('renderErrorNoUser', () => {
    it('should render error message', () => {
      const result = service.renderErrorNoUser();
      expect(result).toContain('Не удалось определить пользователя');
    });
  });

  describe('renderBotStarted', () => {
    it('should render bot started message with username', () => {
      const result = service.renderBotStarted('testbot');
      expect(result).toContain('testbot');
    });
  });

  describe('renderAnalysisPending', () => {
    it('should render pending message', () => {
      const result = service.renderAnalysisPending();
      expect(result).toContain('Анализирую сообщение');
    });
  });

  describe('renderAnalysisError', () => {
    it('should render error message', () => {
      const result = service.renderAnalysisError();
      expect(result).toContain('Не удалось проанализировать');
    });
  });

  describe('renderHistory', () => {
    it('should render empty history message', () => {
      const result = service.renderHistory([]);
      expect(result).toContain('История пуста');
    });

    it('should render message list', () => {
      const messages = [
        { index: 1, id: '10', preview: 'Test message', entityCount: 2 },
        { index: 2, id: '20', preview: 'Another message', entityCount: 0 },
      ];
      const result = service.renderHistory(messages);
      expect(result).toContain('Последние сообщения');
      expect(result).toContain('#10');
      expect(result).toContain('Test message');
      expect(result).toContain('сущностей: 2');
      expect(result).toContain('#20');
      expect(result).toContain('сущностей: 0');
    });
  });

  describe('renderAnalysisReply', () => {
    it('should render no text message when hasText is false', () => {
      const result = service.renderAnalysisReply('42', [], false);
      expect(result).toContain('Текст не найден');
      expect(result).toContain('#42');
    });

    it('should render no entities message when detections are empty', () => {
      const result = service.renderAnalysisReply('42', [], true);
      expect(result).toContain('Сущности не обнаружены');
      expect(result).toContain('#42');
    });

    it('should group detections by type', () => {
      const detections: EntityDetection[] = [
        {
          type: 'person',
          value: 'John Doe',
          normalizedValue: 'john doe',
          confidence: 0.9,
          startOffset: 0,
          endOffset: 8,
          reason: 'Name',
          description: null,
          wikiUrl: null,
        },
        {
          type: 'person',
          value: 'Jane Smith',
          normalizedValue: 'jane smith',
          confidence: 0.85,
          startOffset: 10,
          endOffset: 20,
          reason: 'Name',
          description: null,
          wikiUrl: null,
        },
        {
          type: 'organization',
          value: 'OpenAI',
          normalizedValue: 'openai',
          confidence: 0.95,
          startOffset: 25,
          endOffset: 31,
          reason: 'Company',
          description: null,
          wikiUrl: null,
        },
      ];

      const result = service.renderAnalysisReply('42', detections, true);

      expect(result).toContain('#42');
      expect(result).toContain('Найдено сущностей: 3');
      expect(result).toContain('<b>Персоны:</b>');
      expect(result).toContain('John Doe');
      expect(result).toContain('Jane Smith');
      expect(result).toContain('<b>Организации:</b>');
      expect(result).toContain('OpenAI');
    });

    it('should render description in blockquote when present', () => {
      const detections: EntityDetection[] = [
        {
          type: 'person',
          value: 'Elon Musk',
          normalizedValue: 'elon musk',
          confidence: 0.99,
          startOffset: 0,
          endOffset: 9,
          reason: 'Name',
          description: 'CEO of SpaceX and Tesla',
          wikiUrl: null,
        },
      ];

      const result = service.renderAnalysisReply('42', detections, true);

      expect(result).toContain('Elon Musk');
      expect(result).toContain('<blockquote expandable>CEO of SpaceX and Tesla</blockquote>');
    });

    it('should escape HTML in values', () => {
      const detections: EntityDetection[] = [
        {
          type: 'person',
          value: '<script>alert(1)</script>',
          normalizedValue: '<script>alert(1)</script>',
          confidence: 0.9,
          startOffset: null,
          endOffset: null,
          reason: 'test',
          description: null,
          wikiUrl: null,
        },
      ];

      const result = service.renderAnalysisReply('42', detections, true);

      expect(result).toContain('&lt;script&gt;');
      expect(result).not.toContain('<script>');
    });

    it('should preserve type order: person, organization, location, event, sports_club', () => {
      const detections: EntityDetection[] = [
        {
          type: 'sports_club',
          value: 'FC Barcelona',
          normalizedValue: 'fc barcelona',
          confidence: 0.9,
          startOffset: null,
          endOffset: null,
          reason: 'test',
          description: null,
          wikiUrl: null,
        },
        {
          type: 'person',
          value: 'Messi',
          normalizedValue: 'messi',
          confidence: 0.9,
          startOffset: null,
          endOffset: null,
          reason: 'test',
          description: null,
          wikiUrl: null,
        },
        {
          type: 'location',
          value: 'Barcelona',
          normalizedValue: 'barcelona',
          confidence: 0.9,
          startOffset: null,
          endOffset: null,
          reason: 'test',
          description: null,
          wikiUrl: null,
        },
      ];

      const result = service.renderAnalysisReply('42', detections, true);

      const personIndex = result.indexOf('<b>Персоны:</b>');
      const locationIndex = result.indexOf('<b>Локации:</b>');
      const sportsClubIndex = result.indexOf('<b>Спортивные клубы:</b>');

      expect(personIndex).toBeLessThan(locationIndex);
      expect(locationIndex).toBeLessThan(sportsClubIndex);
    });
  });
});
