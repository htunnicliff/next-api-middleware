import { Middleware } from "./types";

export function isValidMiddleware(
  input: unknown,
  throwOnFailure = false
): input is Middleware {
  const valid = typeof input === "function" && input.length === 3;
  if (!valid && throwOnFailure) {
    throw new Error("Invalid middleware");
  }
  return valid;
}

export function isValidMiddlewareArray(
  input: unknown[],
  throwOnFailure = false
): input is Middleware[] {
  return input.every((item) => isValidMiddleware(item, throwOnFailure));
}
