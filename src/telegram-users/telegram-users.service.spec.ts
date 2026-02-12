import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from 'grammy/types';

import { TelegramUserEntity } from './telegram-user.entity';
import { TelegramUsersService } from './telegram-users.service';

const mockRepository = {
  upsert: jest.fn(),
  findOneByOrFail: jest.fn(),
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
    mockRepository.findOneByOrFail.mockResolvedValue(fakeEntity);

    await service.upsertFromTelegramUser(fullUser);

    expect(mockRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        telegramId: '123456',
        username: 'johndoe',
        firstName: 'John',
        lastName: 'Doe',
        languageCode: 'en',
        isBot: false,
        isPremium: true,
      }),
      { conflictPaths: ['telegramId'], skipUpdateIfNoValuesChanged: false },
    );
  });

  it('should upsert with minimal user (optional fields → null)', async () => {
    mockRepository.findOneByOrFail.mockResolvedValue(fakeEntity);

    await service.upsertFromTelegramUser(minimalUser);

    expect(mockRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        telegramId: '789',
        username: null,
        firstName: 'Bot',
        lastName: null,
        languageCode: null,
        isBot: true,
        isPremium: null,
      }),
      expect.any(Object),
    );
  });

  it('should stringify user.id to telegramId', async () => {
    mockRepository.findOneByOrFail.mockResolvedValue(fakeEntity);

    await service.upsertFromTelegramUser(fullUser);

    const upsertValues = mockRepository.upsert.mock.calls[0][0];
    expect(upsertValues.telegramId).toBe('123456');
    expect(typeof upsertValues.telegramId).toBe('string');
  });

  it('should call findOneByOrFail after upsert', async () => {
    mockRepository.findOneByOrFail.mockResolvedValue(fakeEntity);

    const result = await service.upsertFromTelegramUser(fullUser);

    expect(mockRepository.upsert).toHaveBeenCalledTimes(1);
    expect(mockRepository.findOneByOrFail).toHaveBeenCalledWith({ telegramId: '123456' });
    expect(result).toBe(fakeEntity);
  });
});
