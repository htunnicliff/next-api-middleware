## Examples

### Writing Middleware

Middleware that does work before a request:

```ts
import type { NextMiddleware } from "next-api-middleware";

export const addRequestUUID: NextMiddleware = async (req, res, next) => {
  // Set a custom header
  res.setHeader("X-Response-ID", uuid());

  // Execute the remaining middleware
  await next();
};
```

Middleware that does work before _and_ after a request:

```ts
export const addRequestTiming = async (req, res, next) => {
  // Set a custom header before other middleware and the route handler
  res.setHeader("X-Timing-Start", new Date().getTime());

  // Execute the remaining middleware
  await next();

  // Set a custom header
  res.setHeader("X-Timing-End", new Date().getTime());
};
```

Middleware that catches errors that occur in remaining middleware _and_ the request:

```ts
export const logErrorsWithACME: NextMiddleware = async (req, res, next) => {
  try {
    // Catch any errors that are thrown in remaining
    // middleware and the API route handler
    await next();
  } catch (error) {
    Acme.captureException(error);
    res.status(500);
    res.json({ error: error.message });
  }
};
```

### Middleware groups with `label`

Using `label` creates a middleware group that, by default, doesn't invoke any middleware. Instead, it allows choosing specific middleware by supplying labels as arguments in the API route.

```ts
import { label } from "next-api-middleware";
import {
  addRequestTiming,
  logErrorsWithACME,
  addRequestUUID,
} from "../helpers";

// Create a middleware wrapper that imports middleware and
// assigns friendly labels
const withMiddleware = label({
  timing: addRequestTiming,
  logErrors: logErrorsWithACME,
  uuids: addRequestUUID,
  all: [addRequestTiming, logErrorsWithACME, addRequestUUID],
});

const apiRouteHandler = async (req, res) => {
  const { name } = req.locals.user;

  res.status(200);
  res.send(`Hello, ${name}!`);
};

// Only invoke `addRequestTiming` and `logErrorsWithACME`, using their
// friendly labels
export default withMiddleware("timing", "logErrors")(apiRouteHandler);
```

### Middleware groups with `use`

The `use` method creates a higher order function that applies middleware to an API route. `use` accepts a list of values that evaluate to middleware functions. It also accepts arrays of middleware functions, which are flattened at runtime (order is preserved).

```js
import { use } from "next-api-middleware";
import {
  addRequestTiming,
  logErrorsWithACME,
  addRequestUUID,
} from "../helpers";
import { connectDatabase, loadUsers } from "../users";

// Create a middleware wrapper to be used on API routes
// that need authentication
export const withAuthMiddleware = use(
  addRequestTiming,
  logErrorsWithACME,
  addRequestUUID,
  connectDatabase,
  loadUsers
);

// Create a middleware wrapper to be used on API routes
// that are only used by guests
export const withGuestMiddleware = use(
  isProduction ? [addRequestTiming, logErrorsWithACME] : [],
  addRequestUUID
);

// Create a middleware wrapper using arrays of middleware
// functions; these are flattened and executed in the order
// in which they are provided
export const withXYZMiddleware = use(
  [addRequestUUID, connectDatabase, loadUsers],
  [addRequestTiming, logErrorsWithACME]
);

const apiRouteHandler = async (req, res) => {
  const { name } = req.locals.user;

  res.status(200);
  res.send(`Hello, ${name}!`);
};

export default withAuthMiddleware(apiRouteHandler);
```
