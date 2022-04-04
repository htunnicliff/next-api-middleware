import type { NextApiRequest, NextApiResponse } from "next";

export type Middleware<Request = NextApiRequest, Response = NextApiResponse> = (
  req: Request,
  res: Response,
  next: () => Promise<any>
) => Promise<any>;

export type LabeledMiddleware<
  Request = NextApiRequest,
  Response = NextApiResponse
> = {
  [name: string]:
    | Middleware<Request, Response>
    | Array<Middleware<Request, Response>>;
};
