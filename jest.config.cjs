/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  transform: {
    "^.+\\.(ts|tsx|js|jsx)$": ["ts-jest", {
      useESM: true,
    }],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  transformIgnorePatterns: [],
  extensionsToTreatAsEsm: [".ts", ".tsx", ".mts"],
  resolver: "ts-jest-resolver",
  testPathIgnorePatterns: ["/node_modules/", "\\.d\\.ts$", "/dist/"],
  roots: ["<rootDir>/src"],
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text-summary", "lcov", "html"],
  verbose: true,
  testLocationInResults: true,
  testRunner: "jest-circus/runner",
  reporters: [
    "default",
    ["jest-junit", {
      outputDirectory: "reports",
      outputName: "jest-junit.xml",
      classNameTemplate: "{classname}",
      titleTemplate: "{title}",
      ancestorSeparator: " › ",
      addFileAttribute: true,
    }],
  ],
  testTimeout: 30000,
  forceExit: true,
  detectOpenHandles: true,
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  setupFilesAfterEnv: ["./jest.setup.ts"],
};
