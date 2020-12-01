# Next.js API Middleware

<p>
  <a aria-label="NPM version" href="https://www.npmjs.com/package/next-api-middleware">
    <img alt="NPM version" src="https://img.shields.io/npm/v/next-api-middleware.svg?style=for-the-badge&labelColor=000000">
  </a>
  <a aria-label="License" href="https://github.com/htunnicliff/next-api-middleware/blob/master/LICENSE.txt">
    <img alt="" src="https://img.shields.io/github/license/htunnicliff/next-api-middleware.svg?style=for-the-badge&labelColor=000000">
  </a>
  <a href="https://github.com/htunnicliff/next-api-middleware/actions">
    <img alt="GitHub tests" src="https://img.shields.io/github/workflow/status/htunnicliff/next-api-middleware/Main?style=for-the-badge&labelColor=000000&label=Tests">
  </a>
<p>

## Introduction

[Next.js API routes](https://nextjs.org/docs/api-routes/introduction) are a ridiculously fun and simple way to add backend functionality to a React app. However, when it comes time to add middleware, there is no easy way to implement it.

The official Next.js docs recommend writing functions [inside your API route handler](https://nextjs.org/docs/api-routes/api-middlewares) :thumbsdown:. This is a huge step backward compared to the clean APIs provided by Express.js or Koa.js.

This library attempts to provide minimal, clean, composable middleware patterns that are both productive and pleasant to use. :tada:

## Quick Start

```js
import { use } from "next-api-middleware";

const middleware = use(
  async (req, res, next) => {
    console.log("Do work before the request");
    await next();
    console.log("Clean up");
  },

  async (req, res, next) => {
    console.log("Do more work");
    await next();
    console.log("Clean up more");
  },

  (req, res, next) => {
    console.log("Store user in request");
    req.locals = {
      user: {
        name: "Alice",
        email: "alice@example.com",
      },
    };

    return next();
  }
);

const apiRouteHandler = async (req, res) => {
  const { name } = req.locals.user;

  res.status(200);
  res.send(`Hello, ${name}!`);
};

export default middleware(apiRouteHandler);

/**
 * Console output:
 *
 *   Do work before the request
 *   Do more work
 *   Store user in request
 *   Clean up more
 *   Clean up
 */
```

## Usage

### :one: Create Middleware Functions

```ts
import type { Middleware } from "next-api-middleware";

export const addRequestUUID: Middleware = (req, res, next) => {
  res.setHeader("X-Response-ID", uuid());
  return next();
};

export const addRequestTiming: Middleware = async (req, res, next) => {
  res.setHeader("X-Timing-Start", new Date().getTime());
  await next();
  res.setHeader("X-Timing-End", new Date().getTime());
};

export const logErrorsWithACME: Middleware = async (req, res, next) => {
  try {
    await next();
  } catch (error) {
    Acme.captureException(error);
    res.status(500);
    res.json({ error: error.message });
  }
};
```

### :two: Compose Reusable Groups

```js
import { use } from "next-api-middleware";
import {
  addRequestTiming,
  logErrorsWithACME,
  addRequestUUID,
} from "../helpers";
import { connectDatabase, loadUsers } from "../users";

export const authMiddleware = use(
  addRequestTiming,
  logErrorsWithACME,
  addRequestUUID,
  connectDatabase,
  loadUsers
);

export const guestMiddleware = use(
  isProduction ? [addRequestTiming, logErrorsWithACME] : [],
  addRequestUUID
);

export const otherMiddleware = use(
  [addRequestUUID, connectDatabase, loadUsers],
  [addRequestTiming, logErrorsWithACME]
);
```

The `use` method creates a higher order function that applies middleware to an API route. `use` accepts a list of values that evaluate to middleware functions. It also accepts arrays of middleware functions, which are flattened at runtime (order is preserved).

Another available method for grouping middleware is `label`. Here's how it works:

```ts
import { label } from "next-api-middleware";
import {
  addRequestTiming,
  logErrorsWithACME,
  addRequestUUID,
} from "../helpers";

const middleware = label(
  timing: addRequestTiming,
  logErrors: logErrorsWithACME,
  uuids: addRequestUUID,
  all: [addRequestTiming, logErrorsWithACME, addRequestUUID]
);

const apiRouteHandler = async (req, res) => {
  const { name } = req.locals.user;

  res.status(200);
  res.send(`Hello, ${name}!`);
};

// Invokes `addRequestTiming` and `logErrorsWithACME`
export default middleware(["timing", "logErrors"])(apiRouteHandler);
```

Using `label` creates a middleware group that, by default, doesn't invoke any middleware. Instead, it allows choosing specific middleware by supplying labels as arguments in the API route.

### :three: Apply Middleware to API Routes

To apply a middleware group to an API route, just import it and provide the API route handler as an argument:

```js
import { withGuestMiddleware } from "../../middleware/groups";

const apiHandler = async (req, res) => {
  res.status(200);
  res.send("Hello, world!");
};

export default withGuestMiddleware(apiHandler);
```

## Advanced

### Middleware Factories

Since `use` accepts values that evaluate to middleware functions, this provides the opportunity to create custom middleware factories.

Here's an example of a factory that generates a middleware function to only allow requests with a given HTTP method:

```ts
import { use, Middleware } from "next-api-middleware";

const httpMethod = (
  allowedHttpMethod: "GET" | "POST" | "PATCH"
): Middleware => {
  return async function (req, res, next) {
    if (req.method === allowedHttpMethod || req.method == "OPTIONS") {
      await next();
    } else {
      res.status(404);
      res.end();
    }
  };
};

export const withAuthMiddleware = use(
  httpMethod("POST"),
  addRequestTiming,
  logErrorsWithACME,
  addRequestUUID
);
```
