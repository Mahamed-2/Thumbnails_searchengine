// jest.config.ts — Backend test configuration
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@queue/(.*)$': '<rootDir>/src/queue/$1',
    '^@workers/(.*)$': '<rootDir>/src/workers/$1',
    '^@pipeline/(.*)$': '<rootDir>/src/pipeline/$1',
    '^@storage/(.*)$': '<rootDir>/src/storage/$1',
    '^@database/(.*)$': '<rootDir>/src/database/$1',
    '^@observability/(.*)$': '<rootDir>/src/observability/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/database/seed.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 30000,
  setupFilesAfterFramework: [],
  globalSetup: undefined,
  globalTeardown: undefined,
};

export default config;
