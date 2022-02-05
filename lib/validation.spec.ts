import { isValidMiddleware } from "./validation.js";

describe("isValidMiddleware", () => {
  it("returns false for invalid input", () => {
    expect(isValidMiddleware(NaN)).toBe(false);
    expect(isValidMiddleware(0)).toBe(false);
    expect(isValidMiddleware({})).toBe(false);
    expect(isValidMiddleware(Function)).toBe(false);
    expect(isValidMiddleware([])).toBe(false);
    expect(isValidMiddleware(false)).toBe(false);
    expect(isValidMiddleware(true)).toBe(false);
    expect(isValidMiddleware("")).toBe(false);
    expect(isValidMiddleware((arg1, arg2) => {})).toBe(false);
    expect(isValidMiddleware((arg1, arg2, arg3, arg4) => {})).toBe(false);
  });

  it("returns true for valid input", () => {
    expect(isValidMiddleware((arg1, arg2, arg3) => {})).toBe(true);
  });

  it("throws errors for invalid input when throwOnError is enabled", () => {
    expect(() => isValidMiddleware("", true)).toThrowError(
      "Invalid middleware"
    );
  });
});
