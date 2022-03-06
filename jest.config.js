/** @type {import("@jest/types").Config.InitialOptions} */
export default {
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: ["lib/**"],
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  coverageReporters: ["text", "json"],
  testEnvironment: "node",
  testMatch: ["**/*.spec.ts"],
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
  },
  resolver: "jest-ts-webcompat-resolver",
  setupFilesAfterEnv: ["jest-extended"],
  verbose: true,
};
