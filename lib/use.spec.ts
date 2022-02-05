import { use } from "./use.js";

describe("use", () => {
  it("throws an error for invalid middleware", () => {
    expect(() => use(() => null)).toThrowError();
  });
});
