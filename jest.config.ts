export default {
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: ["lib/**"],
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  coverageReporters: ["text", "json"],
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[tj]s?(x)"],
};
