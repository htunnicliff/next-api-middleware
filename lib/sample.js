const Middleware = new Map();

export const register = (name, fn) => {
  if (Middleware.has(name)) {
    throw new Error(`Middleware already registered for "${name}"`);
  }

  if (Array.isArray(fn)) {
    if (fn.some(value => typeof value !== "function")) {
      throw new Error(`Invalid middleware`);
    }
  }

  Middleware.set(name)
}


export const use = (...names) => {
  Middleware.
}

function isMiddleware(m) {
  if (typeof m === "function") {
    if (m.length === 3) {
      return true;
    }
  }
}
