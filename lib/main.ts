import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";

/**
 * Assert that input is a middleware function
 */
export function isMiddleware(input: unknown): input is Middleware {
  // Does type match `function` and does signature have three arguments?
  return typeof input === "function" && input.length === 3;
}

/**
 * Middleware functions look like Next.js API handlers, with
 * the addition of a third `next` function argument. Functions
 * must either `await next()` or `return next()`.
 */
export type Middleware = (
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => Promise<void>
) => Promise<void>;

/**
 * @example
 * ```js
 * import { use } from "next-api-middleware";
 *
 * const apiHandler = (req, res) => res.send("Hello, world!");
 *
 * export default use(
 *   addTimingHeaders,
 *   addRequestIdHeader,
 *   catchErrorsInSentry,
 *    ...
 * )(apiHandler)
 * ```
 */
export const use = (...input: (Middleware | Middleware[])[]) => {
  // Flatten input.
  const middlewaresFns = input.flat();

  // Check every value for middleware signature.
  if (!middlewaresFns.every(isMiddleware)) {
    throw new Error("Invalid middleware functions");
  }

  return makeMiddlewareExecutor(middlewaresFns);
};

export const named = <
  T extends {
    [name: string]: Middleware | Middleware[];
  }
>(
  namedMiddlewares: T,
  options?: {
    defaults: (keyof T)[];
  }
) => {
  // Check every value for middleware signature.
  if (!Object.values(namedMiddlewares).flat().every(isMiddleware)) {
    throw new Error("Invalid middleware functions");
  }

  return (...chosenMiddleware: (keyof T | Middleware)[]) => {
    // Select middleware based on provided names.
    const middleware: Middleware[] = [
      ...(options?.defaults || []),
      ...chosenMiddleware,
    ].reduce((middleware, chosen) => {
      if (isMiddleware(chosen)) {
        return [...middleware, chosen];
      } else {
        // Validate that chosen exists.
        if (!(chosen in namedMiddlewares)) {
          throw new Error(`Middleware "${chosen}" not available`);
        }

        // Get middleware from named collection.
        const fn = namedMiddlewares[chosen];

        // Add function(s) to array.
        // NOTE: The isArray check allows for middleware groups
        return [...middleware, ...(Array.isArray(fn) ? fn : [fn])];
      }
    }, []);

    return makeMiddlewareExecutor(middleware);
  };
};

export function makeMiddlewareExecutor(middleware: Middleware[]) {
  // Use currying to receive Next.js API route handler.
  return (apiRouteHandler: NextApiHandler) => {
    // Return final handler for Next.js.
    return async (req: NextApiRequest, res: NextApiResponse) => {
      // Define recursive middleware execution function.
      const run = (middleware: Middleware[]) => {
        const [current, ...remaining] = middleware;
        const last = middleware.length === 1;

        // Execute the current middleware, passing along remaining middlewares.
        return current(req, res, async () =>
          // If last, execute the API route handler itself.
          last ? apiRouteHandler(req, res) : run(remaining)
        );
      };

      // Execute all middleware
      return run(middleware);
    };
  };
}
