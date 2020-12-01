import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";

export interface Middleware {
  (
    req: NextApiRequest,
    res: NextApiResponse,
    next: () => Promise<void>
  ): Promise<void>;
}

export interface LabeledMiddleware {
  [name: string]: Middleware | Middleware[];
}

export function use(...middleware: (Middleware | Middleware[])[]) {
  // Flatten middleware groups
  const middlewareFns = middleware.flat();

  // Check signatures
  if (middlewareFns.some((fn) => !hasMiddlewareSignature(fn))) {
    throw new Error("Invalid middleware functions");
  }

  // Make executor
  return makeMiddlewareExecutor(middlewareFns);
}

export function label<T extends LabeledMiddleware>(
  middleware: T,
  defaults: (keyof T)[] = []
) {
  // Check signatures
  if (
    Object.values(middleware)
      .flat()
      .some((fn) => !hasMiddlewareSignature(fn))
  ) {
    throw new Error("Invalid middleware function(s)");
  }

  // Receive chosen middleware (either names or literal middleware functions)
  return function curryMiddlewareChoices(
    ...chosenMiddleware: (keyof T | Middleware)[]
  ) {
    const middlewareFns: Middleware[] = [];

    // Load middleware for each choice
    for (const choice of [...defaults, ...chosenMiddleware]) {
      if (hasMiddlewareSignature(choice)) {
        // Choice is a middleware function, add directly to array
        middlewareFns.push(choice);
      } else {
        // Choice is the name of a registered function, get from registered middleware
        const fn = middleware[choice];
        if (!fn) {
          throw new Error(`Middleware "${choice}" not available`);
        }

        // Add middleware function or group to array
        middlewareFns.push(...(Array.isArray(fn) ? fn : [fn]));
      }
    }

    // Make executor
    return makeMiddlewareExecutor(middlewareFns);
  };
}

/**
 * @private
 */
export function makeMiddlewareExecutor(middlewareFns: Middleware[]) {
  return function curryApiHandler(apiRouteFn: NextApiHandler): NextApiHandler {
    return async function finalRouteHandler(req, res) {
      const execute = ([currentFn, ...remaining]: Middleware[]) =>
        currentFn(req, res, async () =>
          remaining.length === 0 ? apiRouteFn(req, res) : execute(remaining)
        );

      return execute(middlewareFns);
    };
  };
}

/**
 * @private
 */
export function hasMiddlewareSignature(input: unknown): input is Middleware {
  return typeof input === "function" && input.length === 3;
}
