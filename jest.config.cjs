/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['ts-jest', {
      useESM: true,
    }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  setupFilesAfterEnv: ['./jest.setup.ts'],
  extensionsToTreatAsEsm: ['.ts', '.tsx', '.mts'],
  resolver: 'ts-jest-resolver',
  testPathIgnorePatterns: ['/node_modules/', '\\.d\\.ts$', '/dist/'],
  roots: ['<rootDir>/src']
};
