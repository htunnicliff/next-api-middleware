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
            reject(err);
          } else {
            // Async middleware will pause here until `resolve` is called
            await promise;
          }
        });

        // Continue executing middleware
        if (remaining.length === 0) {
          await apiRouteFn(req, res);
        } else {
          await execute(remaining);
        }

        // Everything "beneath" this middleware in the
        // stack should be complete, so let's resolve
        resolve();

        // Wait for the current middlware to finish it's cleanup state
        await result;
      };

      // Execute all middleware
      await execute(middlewareFns);
    };
  };
}
