import { Middleware } from "./index.js";
import { makeMiddlewareExecutor } from "./executor.js";
import { isValidMiddlewareArray } from "./validation.js";

export function use(...middleware: (Middleware | Middleware[])[]) {
  // Flatten middleware groups
  const middlewareFns = middleware.flat();

  // Check signatures
  isValidMiddlewareArray(middlewareFns, true);

  // Make executor
  return makeMiddlewareExecutor(middlewareFns);
}
