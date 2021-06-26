import { NextApiHandler } from "next";
import { Middleware } from ".";
import { controlledPromise } from "./promises";

export function makeMiddlewareExecutor(middlewareFns: Middleware[]) {
  return function curryApiHandler(apiRouteFn: NextApiHandler): NextApiHandler {
    return async function finalRouteHandler(req, res) {
      // Define recursive middleware executor
      const execute = async ([
        currentFn,
        ...remaining
      ]: Middleware[]): Promise<void> => {
        // Create a controlled promise
        const { promise, unpause, fail } = controlledPromise();

        // Execute the current middleware
        const result = currentFn(req, res, async (err?: any) => {
          if (err) {
            fail(err);
          } else {
            // Async middleware will pause here until `unpause` is called
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
        // stack should be complete, so let's unpause
        unpause();

        // Wait for the current middlware to finish it's cleanup state
        await result;
      };

      // Execute all middleware
      await execute(middlewareFns);
    };
  };
}
