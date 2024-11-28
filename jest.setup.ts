// Import the specific types we need from Node.js
import type { TimerOptions } from 'node:timers';

// Define proper types for our global mocks
declare global {
  var mockFindLabelsError: boolean;
  var mockLabels: unknown[] | undefined;
}

// Initialize global mocks
globalThis.mockFindLabelsError = false;
globalThis.mockLabels = undefined;

// Store original timer functions
const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;

// We need to track both Timeout objects and numbers since Node.js can return either
const activeTimers = new Set<NodeJS.Timeout | number>();

// Create our timer wrapper function with the correct type signature
function createSetTimeout() {
  type CustomSetTimeout = {
    (handler: string | Function, ms?: number, ...args: any[]): NodeJS.Timeout | number;
    __promisify__: typeof originalSetTimeout.__promisify__;
  }

  const setTimeout = function(
    handler: string | Function,
    ms?: number,
    ...args: any[]
  ): NodeJS.Timeout | number {
    // Call the original setTimeout and track the result
    const timer = originalSetTimeout(handler, ms, ...args);
    if (typeof timer === 'number') {
      activeTimers.add(timer);
      return timer;
    }
    activeTimers.add(timer);
    return timer;
  } as CustomSetTimeout;

  // Copy over the promisify property using Object.defineProperty
  Object.defineProperty(setTimeout, '__promisify__', {
    value: originalSetTimeout.__promisify__,
    writable: false,
    enumerable: true,
    configurable: true
  });

  return setTimeout as unknown as typeof global.setTimeout;
}

// Create our clearTimeout wrapper with the correct signature
function createClearTimeout() {
  // This type matches Node's clearTimeout signature
  return function clearTimeout(
    timeoutId?: string | number | NodeJS.Timeout | undefined
  ): void {
    if (timeoutId !== undefined) {
      activeTimers.delete(timeoutId as NodeJS.Timeout | number);
      originalClearTimeout(timeoutId);
    }
  };
}

// Create our wrapped versions of the timer functions
const customSetTimeout = createSetTimeout();
const customClearTimeout = createClearTimeout();

// Apply our wrapped versions to the global scope
global.setTimeout = customSetTimeout;
global.clearTimeout = customClearTimeout;

// The rest of your mock setup code remains the same...
jest.mock("@atproto/xrpc", () => ({
  XRPCError: class XRPCError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = "XRPCError";
      this.status = status;
    }
  },
}));

// Clean up after each test
afterEach(async () => {
  // Clear all active timers
  activeTimers.forEach(timerId => {
    originalClearTimeout(timerId);
  });
  activeTimers.clear();

  // Reset mock states
  globalThis.mockFindLabelsError = false;
  globalThis.mockLabels = undefined;

  // Use the original setTimeout for cleanup delay
  await new Promise(resolve => originalSetTimeout(resolve, 100));
});