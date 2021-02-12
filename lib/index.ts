import type { IncomingMessage, ServerResponse } from "http";
import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";

export interface NextMiddleware {
  (
    req: NextApiRequest,
    res: NextApiResponse,
    next: () => Promise<void>
  ): Promise<void>;
}

export interface ExpressMiddleware<
  Request = IncomingMessage,
  Response = ServerResponse
> {
  (
    req: Request,
    res: Response,
    next: (error?: any) => void | Promise<void>
  ): void;
}

export type Middleware = NextMiddleware | ExpressMiddleware;

export interface LabeledMiddleware {
  [name: string]: Middleware | Middleware[];
}

export function use(...middleware: (Middleware | Middleware[])[]) {
  // Flatten middleware groups
  const middlewareFns = middleware.flat();

  // Check signatures
  isValidMiddlewareArray(middlewareFns, true);

  // Make executor
  return makeMiddlewareExecutor(middlewareFns);
}

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

/**
 * @private
 */
export function makeMiddlewareExecutor(middlewareFns: Middleware[]) {
  return function curryApiHandler(apiRouteFn: NextApiHandler): NextApiHandler {
    return async function finalRouteHandler(req, res) {
      const execute = ([
        currentFn,
        ...remaining
      ]: Middleware[]): void | Promise<void> => {
        return currentFn(req, res, async (err?: any) => {
          if (err) {
            throw err;
          }

          return remaining.length === 0
            ? apiRouteFn(req, res)
            : execute(remaining);
        });
      };

      return execute(middlewareFns);
    };
  };
}

/**
 * @private
 */
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

/**
 * @private
 */
export function isValidMiddlewareArray(
  input: unknown[],
  throwOnFailure = false
): input is Middleware[] {
  return input.every((item) => isValidMiddleware(item, throwOnFailure));
}
