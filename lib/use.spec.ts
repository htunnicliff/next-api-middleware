import { use } from "./use";

describe("use", () => {
  it("throws an error for invalid middleware", () => {
    expect(() => use(() => null)).toThrowError();
  });
});
