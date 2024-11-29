// Import the specific types we need from Node.js
import type { TimerOptions } from 'node:timers';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Define proper types for our global mocks
declare global {
  var mockFindLabelsError: boolean;
  var mockLabels: unknown[] | undefined;
  var __MONGOD__: MongoMemoryServer;
}

// Initialize global mocks
globalThis.mockFindLabelsError = false;
globalThis.mockLabels = undefined;

// Mock XRPC Error
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

// Set shorter Jest timeout globally
jest.setTimeout(10000); // 10 seconds default timeout

// Helper function to get MongoDB URI with type safety
export function getMongodUri(): string {
  if (!globalThis.__MONGOD__) {
    throw new Error('MongoDB Memory Server not initialized');
  }
  return globalThis.__MONGOD__.getUri();
}

// Start MongoDB Memory Server once for all tests
beforeAll(async () => {
  globalThis.__MONGOD__ = await MongoMemoryServer.create();
});

// Clean up MongoDB Memory Server after all tests
afterAll(async () => {
  if (globalThis.__MONGOD__) {
    await globalThis.__MONGOD__.stop();
  }
});

// Clean up after each test
afterEach(() => {
  // Reset mock states
  globalThis.mockFindLabelsError = false;
  globalThis.mockLabels = undefined;
});