import type { NextApiRequest, NextApiResponse } from "next";

export interface NextMiddleware {
  (
    req: NextApiRequest,
    res: NextApiResponse,
    next: () => Promise<void>
  ): Promise<void>;
}

export interface ExpressMiddleware<Request = any, Response = any> {
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
