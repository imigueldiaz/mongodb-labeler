import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// Define proper types for our global mocks
declare global {
  var mockFindLabelsError: boolean;
  var mockLabels: unknown;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  var __MONGOD__: MongoMemoryServer | undefined;
}

// Inicialización de variables globales
let mongoClient: MongoClient | null = null;

// Initialize MongoDB Memory Server before all tests
beforeAll(async () => {
  // Initialize global mocks
  globalThis.mockFindLabelsError = false;
  globalThis.mockLabels = undefined;

  // Mock XRPC Error
  vi.mock("@atproto/xrpc", () => ({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    XRPCError: class XRPCError extends Error {
      status: number;
      constructor(status: number, message: string) {
        super(message);
        this.name = "XRPCError";
        this.status = status;
      }
    },
  }));

  try {
    globalThis.__MONGOD__ = await MongoMemoryServer.create({
      instance: {
        dbName: 'vitest',
        storageEngine: 'wiredTiger'
      }
    });
    console.log('MongoDB Memory Server started successfully');
    mongoClient = await MongoClient.connect(globalThis.__MONGOD__.getUri());
  } catch (error) {
    console.error('Failed to start MongoDB Memory Server:', error);
    throw error;
  }
});

// Cleanup after all tests
afterAll(async () => {
  try {
    if (mongoClient) {
      await mongoClient.close(true);
      mongoClient = null;
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (globalThis.__MONGOD__) {
      await globalThis.__MONGOD__.stop({ doCleanup: true });
      console.log('MongoDB Memory Server stopped successfully');
    }
  } catch (error) {
    console.error('Failed to stop MongoDB Memory Server:', error);
    throw error;
  }
});

// Helper function to get MongoDB URI with type safety
export function getMongodUri(): string {
  const mongod = globalThis.__MONGOD__;
  if (!mongod) {
    throw new Error('MongoDB Memory Server is not initialized');
  }
  return mongod.getUri();
}

// Hooks para limpieza entre tests
afterEach(() => {
  globalThis.mockFindLabelsError = false;
  globalThis.mockLabels = undefined;
  vi.clearAllMocks();
});