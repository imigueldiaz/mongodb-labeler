/**
 * Type guard to check if an error is an instance of Error
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Safe error handler for async operations
 */
export async function safeAsyncOperation<T>(
  operation: () => Promise<T>,
  errorPrefix = 'Operation failed'
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(errorPrefix + ':', isError(error) ? error.message : String(error));
    throw error;
  }
}

/**
 * Get a safe error message from any error type
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  return String(error);
}
