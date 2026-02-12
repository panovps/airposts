import type { Config } from 'jest';

const config: Config = {
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { types: ['jest', 'node'] } }],
  },
  testRegex: '.*\\.spec\\.ts$',
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.service.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
};

export default config;
