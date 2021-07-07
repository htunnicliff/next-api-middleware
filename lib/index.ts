import type { IncomingMessage, ServerResponse } from "http";
import type { NextApiRequest, NextApiResponse } from "next";

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

export * from "./label";
export * from "./use";
