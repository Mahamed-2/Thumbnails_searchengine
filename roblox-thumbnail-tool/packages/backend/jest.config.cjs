/** @type {import('jest').Config} */
const config = {
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
    '^@app-types/(.*)$': '<rootDir>/src/types/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/database/seed.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 30000,
  setupFiles: ['<rootDir>/tests/setup.ts'],
};

module.exports = config;
