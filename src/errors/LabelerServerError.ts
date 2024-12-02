/**
* Error class for LabelerServer operations
*/
export class LabelerServerError extends Error {
    constructor(message: string, public readonly cause?: Error) {
      super(message);
      this.name = "LabelerServerError";
    }
  }
