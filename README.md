# Next API Middleware

<a aria-label="NPM version" href="https://www.npmjs.com/package/next-api-middleware">
  <img alt="" src="https://flat.badgen.net/npm/v/next-api-middleware">
</a>

Next.js API routes are a ridiculously fun and simple way to add backend functionality to a React app. However, when it comes time to add middleware, there are no easy ways to implement it. The official Next.js docs recommend just running middleware as functions within your API route. This is a huge step backward compared to the clean APIs provided by Express.js or Koa.js.

This library is an attempt to provide Next.js applications with clean, composable middleware patterns inspired by Koa.js.

## Get Started

There are only two methods you need to learn: `named` and `use`. Both are two different ways to tackle the challenge of adding reusable middleware throughout your applications API routes.

### `named`

This method is a great choice if you want to stop importing the same middleware functions over and over for each API route.

Here's a quick example:

```js
// helpers/middleware.js
import { named } from "next-api-middleware";

export const chooseMiddleware = named({
  ...
  handleErrorsWithSentry,
  addRequestIds,
  addTimingHeaders: async (req, res, next) => {
    res.setHeader("X-Timing-Start", new Date().getTime());
    await next();
    res.setHeader("X-Timing-End", new Date().getTime());
  },
  connectDatabase,
  ...
});

// pages/api/hello-world.js
import { chooseMiddleware } from "../../helpers/middleware";

// Define a Next.js API handler
const apiHandler = async (req, res) => {
  res.status(200);
  res.send("Hello, world!");
};

// Choose specific middleware to use for this API route
export default chooseMiddleware(
  "handleErrorsWithSentry",
  "addRequestIds",
  // You can also create middleware inline, if desired
  async (req, res, next) => {
    console.log("Hello, console!");
    await next();
    console.log("Goodbye, console!");
  }
)(apiHandler);
```

Supplying middleware functions to `named` creates the `chooseMiddleware` (or whatever you want to call it) function. As you can see, `chooseMiddleware` makes it a piece of cake to choose and order specific middleware functions for any API route handler. You can also create middleware inline, if needed.

### `use`

If you want a more granular approach to adding route middleware, try working with `use` instead. Here's an example:

```js
// pages/api/hello-world.js
import { use } from "next-api-middleware";
import { handleErrorsWithSentry } from "../../helpers/middleware/sentry";
import { addRequestIds } from "../../helpers/middleware/requests";

// Define a Next.js API handler
const apiHandler = async (req, res) => {
  res.status(200);
  res.send("Hello, world!");
};

export default use(handleErrorsWithSentry, addRequestIds)(apiHandler);
```

`use` can also be helpful for creating reusable functions that apply the same middleware every time:

```js
// helpers/middleware/users.js
import { use } from "next-api-middleware";

// Note that the API route is NOT passed to the curried function
export const withAuth = use(
  handleErrorsWithSentry,
  addRequestIds,
  loadDatabase,
  loadUser: (req, res, next) => {
    req.locals.user = { id: 123, name: "Alice" };
    return next();
  }
);

export const withGuest = use(handleErrorsWithSentry, addRequestIds);

// pages/api/welcome.js

const apiHandler = async (req, res) => {
  res.status(200);
  res.send(`Welcome, ${req.locals.user.name}!`);
};

export default withAuth(apiHandler);
```
