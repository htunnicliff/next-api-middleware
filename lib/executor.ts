import { NextApiHandler } from "next";
import { Middleware } from ".";
import { controlledPromise } from "./promises";

// This gets invoked internally by `use` and `label`
export function makeMiddlewareExecutor(middlewareFns: Middleware[]) {
  // This curried function receives an API route
  return function curryApiHandler(apiRouteFn: NextApiHandler): NextApiHandler {
    // The final function returned is a Next API handler that
    // is responsible for executing all the middleware provided,
    // as well as the API route handler
    return async function finalRouteHandler(req, res) {
      // Define recursive middleware executor
      const execute = async ([
        currentFn,
        ...remaining
      ]: Middleware[]): Promise<void> => {
        // Create a controlled promise
        const { promise, resolve, reject } = controlledPromise();

        // Call the current middleware
        const result = currentFn(req, res, async (err?: any) => {
          if (err) {
            // Only Express middleware with errors can reject
            reject(err);
          } else {
            // Async middleware will pause here until the controlled
            // promise is resolved.
            await promise;
          }

          // Since Express middleware treats this function as a
          // callback, it will never be `awaited`.
        });

        if (remaining.length === 0) {
          // Execute API route handler
          await apiRouteFn(req, res);
        } else {
          // Continue executing middleware
          await execute(remaining);
        }

        // Everything "beneath" this middleware in the
        // stack should be complete, so let's resolve
        resolve();

        // Wait for the current middlware to finish its cleanup state
        await result;
      };

      // Execute all middleware
      await execute(middlewareFns);
    };
  };
}
