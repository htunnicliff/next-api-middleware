import { LabeledMiddleware, Middleware } from "./index.js";
import { makeMiddlewareExecutor } from "./executor.js";
import { isValidMiddleware, isValidMiddlewareArray } from "./validation.js";

export function label<T extends LabeledMiddleware>(
  middleware: T,
  defaults: (keyof T)[] = []
) {
  // Check signatures
  isValidMiddlewareArray(Object.values(middleware).flat(), true);

  // Receive chosen middleware (either names or literal middleware functions)
  return function curryMiddlewareChoices(
    ...chosenMiddleware: (keyof T | Middleware | Middleware[])[]
  ) {
    const middlewareFns: Middleware[] = [];

    // Load middleware for each choice
    for (const choice of [...defaults, ...chosenMiddleware]) {
      // Choice is the name of a registered function, get from registered middleware
      if (typeof choice === "string") {
        const fn = middleware[choice];
        if (!fn) {
          throw new Error(`Middleware "${choice}" not available`);
        }

        // Add middleware function or group to array
        middlewareFns.push(...(Array.isArray(fn) ? fn : [fn]));
        continue;
      }

      if (Array.isArray(choice) && isValidMiddlewareArray(choice, true)) {
        // Choice is an array of middleware functions
        middlewareFns.push(...choice);
        continue;
      }

      if (isValidMiddleware(choice, true)) {
        // Choice is a middleware function, add directly to array
        middlewareFns.push(choice);
        continue;
      }
    }

    // Make executor
    return makeMiddlewareExecutor(middlewareFns);
  };
}
