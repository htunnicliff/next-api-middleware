import { NextApiHandler } from "next";
import { Middleware } from ".";

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
