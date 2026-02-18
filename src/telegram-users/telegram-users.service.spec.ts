import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from 'grammy/types';

import { TelegramUserEntity } from './telegram-user.entity';
import { TelegramUsersService } from './telegram-users.service';

const mockQueryBuilder = {
  insert: jest.fn().mockReturnThis(),
  into: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  orUpdate: jest.fn().mockReturnThis(),
  returning: jest.fn().mockReturnThis(),
  execute: jest.fn(),
};

const mockRepository = {
  upsert: jest.fn(),
  findOneByOrFail: jest.fn(),
  createQueryBuilder: jest.fn(() => mockQueryBuilder),
};

describe('TelegramUsersService', () => {
  let service: TelegramUsersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        TelegramUsersService,
        { provide: getRepositoryToken(TelegramUserEntity), useValue: mockRepository },
      ],
    }).compile();

    service = module.get(TelegramUsersService);
  });

  const fullUser: User = {
    id: 123456,
    is_bot: false,
    first_name: 'John',
    last_name: 'Doe',
    username: 'johndoe',
    language_code: 'en',
    is_premium: true,
  };

  const minimalUser: User = {
    id: 789,
    is_bot: true,
    first_name: 'Bot',
  };

  const fakeEntity: Partial<TelegramUserEntity> = {
    id: '1',
    telegramId: '123456',
    username: 'johndoe',
    firstName: 'John',
    lastName: 'Doe',
  };

  it('should upsert with full user fields', async () => {
    mockQueryBuilder.execute.mockResolvedValue({ raw: [fakeEntity] });

    const result = await service.upsertFromTelegramUser(fullUser);

    expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
    expect(mockQueryBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        telegramId: '123456',
        username: 'johndoe',
        firstName: 'John',
        lastName: 'Doe',
        languageCode: 'en',
        isBot: false,
        isPremium: true,
      }),
    );
    expect(result).toEqual(fakeEntity);
  });

  it('should upsert with minimal user (optional fields → null)', async () => {
    const minimalEntity = { ...fakeEntity, telegramId: '789' };
    mockQueryBuilder.execute.mockResolvedValue({ raw: [minimalEntity] });

    const result = await service.upsertFromTelegramUser(minimalUser);

    expect(mockQueryBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        telegramId: '789',
        username: null,
        firstName: 'Bot',
        lastName: null,
        languageCode: null,
        isBot: true,
        isPremium: null,
      }),
    );
    expect(result).toHaveProperty('telegramId', '789');
  });

  it('should stringify user.id to telegramId', async () => {
    mockQueryBuilder.execute.mockResolvedValue({ raw: [fakeEntity] });

    await service.upsertFromTelegramUser(fullUser);

    const upsertValues = mockQueryBuilder.values.mock.calls[0][0];
    expect(upsertValues.telegramId).toBe('123456');
    expect(typeof upsertValues.telegramId).toBe('string');
  });

  it('should return entity from RETURNING clause', async () => {
    mockQueryBuilder.execute.mockResolvedValue({ raw: [fakeEntity] });

    const result = await service.upsertFromTelegramUser(fullUser);

    expect(mockQueryBuilder.returning).toHaveBeenCalledWith('*');
    expect(result).toEqual(fakeEntity);
  });
});
