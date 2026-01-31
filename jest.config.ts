import type { Config } from 'jest';

const config: Config = {
  projects: [
    {
      displayName: 'node',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      testMatch: ['**/*.test.ts'],
    },
    {
      displayName: 'jsdom',
      testEnvironment: 'jest-environment-jsdom',
      roots: ['<rootDir>/src'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      testMatch: ['**/*.test.tsx'],
      setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          { tsconfig: { jsx: 'react-jsx' } },
        ],
      },
    },
  ],
};

export default config;
