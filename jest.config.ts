import { Config } from "@jest/types";

const config: Config.InitialOptions = {
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: ["lib/**"],
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  coverageReporters: ["text", "json"],
  testEnvironment: "node",
  testMatch: ["**/*.spec.ts"],
  setupFilesAfterEnv: ["jest-extended"],
  verbose: true,
};

export default config;
