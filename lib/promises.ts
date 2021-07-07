export function controlledPromise() {
  // Define variables to hold references to the resolve
  // and reject handlers within a real promise.
  let resolve: () => void = () => {
    // No-op
  };

  let reject: (err: any) => void = () => {
    // No-op
  };

  // Create a promise and assign its actual resolver and rejecter
  // handlers to the reference variables
  const promise = new Promise<void>((actualResolve, actualReject) => {
    resolve = actualResolve;
    reject = actualReject;
  });

  return {
    promise,
    resolve: resolve,
    reject: reject,
  };
}

export function isPromise(input: unknown): input is Promise<void> {
  return typeof input === "object" && input !== null && "then" in input;
}
