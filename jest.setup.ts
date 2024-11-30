// Import the specific types we need from Node.js
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { vi, beforeAll, afterAll, afterEach } from 'vitest';

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
vi.mock("@atproto/xrpc", () => ({
  XRPCError: class XRPCError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = "XRPCError";
      this.status = status;
    }
  },
}));

// Helper function to get MongoDB URI with type safety
export function getMongodUri(): string {
  if (!globalThis.__MONGOD__) {
    throw new Error('MongoDB Memory Server not initialized');
  }
  return globalThis.__MONGOD__.getUri();
}

let mongoClient: MongoClient | null = null;

// Start MongoDB Memory Server once for all tests
beforeAll(async () => {
  try {
    globalThis.__MONGOD__ = await MongoMemoryServer.create({
      instance: {
        dbName: 'jest',
        storageEngine: 'wiredTiger'
      }
    });
    
    // Inicializamos la conexión que usaremos en los tests
    mongoClient = await MongoClient.connect(globalThis.__MONGOD__.getUri());
    console.log('MongoDB Memory Server started successfully');
  } catch (error) {
    console.error('Failed to start MongoDB Memory Server:', error);
    throw error;
  }
});

afterAll(async () => {
  try {
    // Cerramos la conexión si existe
    if (mongoClient) {
      await mongoClient.close(true);
      mongoClient = null;
    }
    
    // Esperamos un poco antes de detener el servidor
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Detenemos el servidor
    if (globalThis.__MONGOD__) {
      await globalThis.__MONGOD__.stop({ doCleanup: true });
      console.log('MongoDB Memory Server stopped successfully');
    }
  } catch (error) {
    console.error('Failed to stop MongoDB Memory Server:', error);
    throw error;
  }
});

// Clean up after each test
afterEach(() => {
  // Reset mock state
  globalThis.mockFindLabelsError = false;
  globalThis.mockLabels = undefined;
});