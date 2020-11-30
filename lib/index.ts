import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";

export type Middleware = (
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void | Promise<void>
) => Promise<void>;

// Compose
// Groups

export function wrap(
  inputs: Middleware[],
  routeHandler: NextApiHandler
): NextApiHandler {
  return async function (req, res): Promise<void> {
    const middleware: Middleware[] = inputs.map((input) => {
      return input;
    });

    function run([current, ...remaining]: Middleware[]): Promise<void> {
      const last = remaining.length === 0;

      return current(req, res, () =>
        !last ? run(remaining) : routeHandler(req, res)
      );
    }

    return run(middleware);
  };
}

export type LikeMiddleware =
  | Middleware
  | Middleware[]
  | { [k: string]: Middleware | Middleware[] };

export function flatten(...likeMiddleware: LikeMiddleware[]): Middleware[] {
  return likeMiddleware.map((item) => {
    return item;
  });
}

export function makeWrap(...inputs: Middleware[]) {
  return async function (req, res): Promise<void> {
    const middleware: Middleware[] = inputs.map((input) => {
      return input;
    });

    function run([current, ...remaining]: Middleware[]): Promise<void> {
      const last = remaining.length === 0;

      return current(req, res, () =>
        !last ? run(remaining) : routeHandler(req, res)
      );
    }

    return run(middleware);
  };
}
