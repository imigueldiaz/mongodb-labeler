/**
 * Custom error for AT Protocol validation failures
 */
export class AtProtocolValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AtProtocolValidationError";
    }
  }