<p align="center">
  <h1 align="center">Next.js API Middleware</h1>
</p>

<p align="center">
  <a aria-label="npm@latest" href="https://www.npmjs.com/package/next-api-middleware">
    <img alt="npm@latest" src="https://img.shields.io/npm/v/next-api-middleware/latest.svg?style=for-the-badge&labelColor=000000">
  </a>
  <a aria-label="npm@canary" href="https://www.npmjs.com/package/next-api-middleware">
    <img alt="npm@canary" src="https://img.shields.io/npm/v/next-api-middleware/canary.svg?style=for-the-badge&labelColor=000000">
  </a>
  <a aria-label="license" href="https://github.com/htunnicliff/next-api-middleware/blob/master/LICENSE">
    <img alt="license" src="https://img.shields.io/github/license/htunnicliff/next-api-middleware.svg?style=for-the-badge&labelColor=000000">
  </a>
</p>
<p align="center">
  <a aria-label="tests" href="https://github.com/htunnicliff/next-api-middleware/actions?query=workflow%3ATest">
    <img alt="tests" src="https://img.shields.io/github/workflow/status/htunnicliff/next-api-middleware/Test?style=for-the-badge&labelColor=000000&label=Tests">
  </a>
  <a aria-label="coverage" href="https://codecov.io/gh/htunnicliff/next-api-middleware/">
    <img alt="Codecov" src="https://img.shields.io/codecov/c/github/htunnicliff/next-api-middleware?style=for-the-badge&labelColor=000000&token=XI7G8L08TY">
  </a>
<p>

## Introduction

[Next.js API routes](https://nextjs.org/docs/api-routes/introduction) are a ridiculously fun and simple way to add backend functionality to a React app. However, when it comes time to add middleware, there is no easy way to implement it.

The official Next.js docs recommend writing functions [inside your API route handler](https://nextjs.org/docs/api-routes/api-middlewares) :thumbsdown:. This is a huge step backward compared to the clean APIs provided by Express.js or Koa.js.

This library attempts to provide minimal, clean, composable middleware patterns that are both productive and pleasant to use. :tada:

## Table of Contents

- [Quick Start](#quick-start)
- [How It Works](#quick-start)
- [APIs](#apis)
  - [`label`](#label)
  - [`use`](#use)
- [Usage Guide](#usage-guide)
- [Advanced](#advanced)
  - [Debugging](#debugging)
  - [Middleware Factories](#middleware-factories)
  - [Middleware Types](#middleware-types)
    - [`NextMiddleware`](#nextmiddleware-preferred)
    - [`ExpressMiddleware`](#expressmiddleware-compatibility)

## Quick Start

```ts
import { label, NextMiddleware } from "next-api-middleware";
import * as Sentry from "@sentry/nextjs";
import nanoid from "nanoid";

// 1 – Create middleware functions

const captureErrors: NextMiddleware = async (req, res, next) => {
  try {
    // Catch any errors that are thrown in remaining
    // middleware and the API route handler
    await next();
  } catch (err) {
    const eventId = Sentry.captureException(err);

    res.status(500);
    res.json({ error: err });
  }
};

const addRequestId: NextMiddleware = async (req, res, next) => {
  // Let remaining middleware and API route execute
  await next();

  // Apply header
  res.setHeader("X-Response-ID", nanoid());
};

// 2 – Use `label` to assemble all middleware

const withMiddleware = label(
  {
    addRequestId,
    sentry: captureErrors, // <-- Optionally alias middleware
  },
  ["sentry"] // <-- Provide a list of middleware to call automatically
);

// 3 – Define your API route handler

const apiRouteHandler = async (req, res) => {
  res.status(200);
  res.send("Hello world!");
};

// 4 – Choose middleware to invoke for this API route

export default withMiddleware("addRequestId")(apiRouteHandler);
```

## How It Works

My mental model for how this library handles middleware functions is that of a "winding and unwinding stack."

Let's imagine you've used `label` to add two middleware functions to an API route.

When a request comes in, this is a rough impression of how that request makes its way through all middleware functions, the API route handler itself, and then back up through the middleware.

```
              |-----------------|-----------------|--------------------|
              |  Middleware #1  |  Middleware #2  | API Route Handler  |
              |-----------------|-----------------|--------------------|
              |                 |                 |                    |
Request ------|----> Setup -----|----> Setup -----|-->------|          |
              |                 |                 |         |          |
              |-----------------|-----------------|         V          |
              |                 |                 |                    |
              |   await next()  |   await next()  |     API stuff      |
              |                 |                 |                    |
              |-----------------|-----------------|         |          |
              |                 |                 |         |          |
Response <----|--- Teardown <---|--- Teardown <---|---------|          |
              |                 |                 |                    |
              |-----------------|-----------------|--------------------|
```

While this is a crummy ASCII diagram, I think it gives the right impression. The request winds its way though each middleware function in succession, hits the API route handler, and then proceeds to "unwind" its way through the stack.

Every middleware function has the opportunity to go through three phases:

1. Setup
2. Waiting
3. Teardown

The "Setup" phase covers everything that happens before `await next()`. The "Waiting" phase is really just `await next()`. The "Teardown" phase is the remaining code within a middleware function after `await next()`.

It is worth noting that although these phases are available to all middleware functions, you don't need to take advantage of them all.

For example, in error catching middleware you might simply wrap `await next()` in a `try / catch` block. On the other hand, you might have request timing middleware that captures a start time during the setup phase, waits, and then captures a finish time in the teardown phase.

## APIs

### `label`

This is the primary utility for creating reusuable collections of middleware for use throughout many Next.js API routes.

```ts
const withMiddleware = label(middleware, defaults);
```

#### Parameters

- `middleware`: an object containing middleware functions or arrays of middleware
- `defaults`: (optional) an array of `middleware` keys that will be invoked automatically

#### Return Value

`label` returns a function (conventionally referred to as `withMiddleware`) that uses currying to accept a list of middleware names to be invoked, followed by a Next.js API handler function.

Typically, `withMiddleware` will be imported in API route files and used at the default export statement:

```ts
import { withMiddleware } from "../helpers/my-middleware";

const apiRouteHandler = async (req, res) => {
  ...
}

export default withMiddleware("foo", "bar", "baz")(apiRouteHandler);
```

Though `label` could contain many middleware functions, the actual middleware invoked by an API route is determined by the names passed in to `withMiddleware`.

#### Examples

##### Basic Use

```ts
const logErrors = async (req, res, next) => {
  try {
    await next();
  } catch (error) {
    console.error(error);
    res.status(500);
    res.json({ error });
  }
};

const withMiddleware = label({
  logErrors,
});

// export default withMiddleware("logErrors")(apiRouteHandler);
```

##### Aliases

```ts
const withMiddleware = label({
  error: logErrors,
});

// export default withMiddleware("error")(apiRouteHandler);
```

##### Groups

```ts
import { foo, bar, baz } from "./my-middleware";

const withMiddleware = label({
  error: logErrors,
  myGroup: [foo, bar, baz],
});

// export default withMiddleware("error", "myGroup")(apiRouteHandler);
```

##### Defaults

```ts
const withMiddleware = label(
  {
    error: logErrors,
    myGroup: [foo, bar, baz],
  },
  ["error"]
);

// export default withMiddleware("myGroup")(apiRouteHandler);
```

### `use`

This utility accepts middleware functions directly and executes them all in order. It is a simpler alternative to `label` that can be useful for handling one-off middleware functions.

```ts
const withInlineMiddleware = use(...middleware);
```

#### Parameters

- `middleware`: a list of middleware functions and/or arrays of middleware functions

#### Return Value

`use` returns a function that accepts a Next.js API route handler.

#### Examples

##### CORS

```ts
import { use } from "next-api-middleware";
import cors from "cors";

const apiRouteThatOnlyNeedsCORS = async (req, res) => {
  ...
}

export default use(cors())(apiRouteThatOnlyNeedsCORS);
```

## Usage Guide

See [EXAMPLES.md](./EXAMPLES.md) for more detailed examples of `label` and `use`.

## Advanced

### Debugging

`next-api-middleware` uses [`debug`](https://npmjs.com/package/debug) to provide different levels of debug logging.

Logs for this library are available under the `middleware` namespace.

> These example commands assume the presence of a script called `dev` in your project's `package.json` that runs `next dev`.

```sh
# Show all logs
DEBUG=middleware:* npm run dev

# Show all logs for the `/api/foo` route
DEBUG=middleware:/api/foo npm run dev

# Show all logs for the 3rd middleware function in `/api/foo`
DEBUG=middleware:/api/foo:fn-3 npm run dev
```

You can also wrap the value of `DEBUG` in quotes if desired:

```sh
DEBUG='middleware:/api/foo' npm run dev
```

### Middleware Factories

Since `use` and `label` accept values that evaluate to middleware functions, this provides the opportunity to create custom middleware factories.

Here's an example of a factory that generates a middleware function to only allow requests with a given HTTP method:

```ts
import { NextMiddleware } from "next-api-middleware";

const httpMethod = (
  allowedHttpMethod: "GET" | "POST" | "PATCH"
): NextMiddleware => {
  return async function (req, res, next) {
    if (req.method === allowedHttpMethod || req.method == "OPTIONS") {
      await next();
    } else {
      res.status(404);
      res.end();
    }
  };
};

export const postRequestsOnlyMiddleware = httpMethod("POST");
```

### Middleware Types

`next-api-middleware` supports two middleware signatures, `NextMiddleware` and `ExpressMiddleware`.

#### `NextMiddleware`

`NextMiddleware` is inspired by the asyncronous middleware style popularized by Koa.js. Prefer this style when writing your own middleware.

```ts
interface NextMiddleware {
  (
    req: NextApiRequest,
    res: NextApiResponse,
    next: () => Promise<void>
  ): Promise<void>;
}
```

#### `ExpressMiddleware` (compatibility)

`ExpressMiddleware` roughly matches the signature used by Express/Connect style middleware. This type can be used when importing third-party libraries such as `cors`.

```ts
interface ExpressMiddleware<
  Request = IncomingMessage,
  Response = ServerResponse
> {
  (
    req: Request,
    res: Response,
    next: (error?: any) => void | Promise<void>
  ): void;
}
```

An example using `cors`:

```ts
import { use } from "next-api-middleware";
import cors from "cors";

export const withMiddleware = use(
  // Asserting express/connect middleware as an `ExpressMiddleware` interface
  // can resolve type conflicts by libraries that provide their own types.
  cors() as ExpressMiddleware
);
```
