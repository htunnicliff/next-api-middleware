export function controlledPromise<Result = void, Error = any>() {
  // Define variables to hold references to the resolve
  // and reject handlers within a real promise.
  let resolve: (value: Result | PromiseLike<Result>) => void;
  let reject: (err: Error) => void;

  // Create a promise and assign its actual resolver and rejecter
  // handlers to the reference variables
  const promise = new Promise<Result>((actualResolve, actualReject) => {
    resolve = actualResolve;
    reject = actualReject;
  });

  return {
    promise,
    // @ts-ignore
    resolve: resolve,
    // @ts-ignore
    reject: reject,
  };
}

export function isPromise<Result>(input: unknown): input is Promise<Result> {
  return typeof input === "object" && input !== null && "then" in input;
}
