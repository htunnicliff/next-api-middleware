import { Middleware } from "./types";
import { makeMiddlewareExecutor } from "./executor";
import { isValidMiddlewareArray } from "./validation";

export function use(...middleware: (Middleware | Middleware[])[]) {
  // Flatten middleware groups
  const middlewareFns = middleware.flat();

  // Check signatures
  isValidMiddlewareArray(middlewareFns, true);

  // Make executor
  return makeMiddlewareExecutor(middlewareFns);
}
