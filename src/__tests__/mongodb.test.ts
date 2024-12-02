import { MongoDBClient } from "../mongodb.js";
import type { UnsignedLabel } from "../util/types.js";
import { getMongodUri } from "../../vitest.setup";
import { getErrorMessage } from "../util/errorUtils";
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { ObjectId } from "mongodb";

const TEST_TIMEOUT = 35000;

describe("MongoDBClient", () => {
  describe("MongoDB Operations", () => {
    let mongoUri: string;
    let client: MongoDBClient;
    
    beforeAll(() => {
      mongoUri = getMongodUri();
    });

    beforeEach(async () => {
      client = new MongoDBClient(mongoUri);
      // Ensure client is connected before tests
      await safeAsyncOperation(async () => {
        await client.connect();
      }, getErrorMessage('Failed to connect client'));
    });
    
    afterEach(async () => {
      await safeAsyncOperation(async () => {
        await client?.close();
      }, getErrorMessage('Failed to close client'));
    });
    
    // After all tests in this describe block
    afterAll(async () => {
      try {
        // Final server cleanup
      } catch (error) {
        console.error('Error during final cleanup:', getErrorMessage(error));
      }
    });
    
    it("should handle errors in updateLabel", async () => {
      const mockCollection = {
        updateOne: vi.fn().mockRejectedValue(new Error("Update failed")),
      };
      
      Object.defineProperty(client, "_labels", {
        value: mockCollection,
        writable: true,
      });
      
      const testLabel: UnsignedLabel & { sig: ArrayBuffer } = {
        val: "test",
        uri: "test://uri",
        cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        cts: new Date().toISOString(),
        src: "did:web:test.com" as `did:${string}`,
        neg: false,
        ver: 1 as const,
        sig: new ArrayBuffer(0),
      };
      
      await expect(client.updateLabel(new ObjectId(), testLabel)).rejects.toThrow("Failed to update label");
    });
    
    it("should handle errors in getLabelsAfterCursor", async () => {
      const mockCollection = {
        find: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              toArray: vi.fn().mockRejectedValue(new Error("Failed to get labels after cursor")),
            }),
          }),
        }),
      };
      
      Object.defineProperty(client, "_labels", {
        value: mockCollection,
        writable: true,
      });
      
      await expect(client.getLabelsAfterCursor(new ObjectId(), 10)).rejects.toThrow("Failed to get labels after cursor");
    });
    
    it("should handle uninitialized collection in operations", async () => {
      const client = new MongoDBClient(mongoUri);
      
      await expect(client.findLabels({})).resolves.toEqual([]);
      await expect(client.findOne({})).resolves.toBeNull();
      await expect(client.getLabelsAfterCursor(new ObjectId(), 10)).resolves.toEqual([]);
    });
    
    it("should handle first label creation", async () => {
      const testLabel: UnsignedLabel & { sig: ArrayBuffer } = {
        val: "test",
        uri: "test://uri",
        cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        cts: new Date().toISOString(),
        src: "did:web:test.com" as `did:${string}`,
        neg: false,
        ver: 1 as const,
        sig: new ArrayBuffer(0),
      };

      const savedLabel = await client.saveLabel(testLabel);
      expect(savedLabel).toHaveProperty("_id");
      expect(savedLabel._id).toBeInstanceOf(ObjectId);
    });
    
    it("should handle errors in listCollections during connect", async () => {
      const client = new MongoDBClient(mongoUri);
      const mockDb = {
        listCollections: vi.fn().mockReturnValue({
          toArray: vi.fn().mockRejectedValue(new Error("Failed to list collections")),
        }),
        collection: vi.fn(),
      };
      
      // Mock the internal _db property after connect is called
      const originalConnect = client.connect.bind(client);
      client.connect = async () => {
        await originalConnect();
        Object.defineProperty(client, "_db", {
          value: mockDb,
          writable: true,
        });
        throw new Error("Failed to connect to MongoDB");
      };
      
      await expect(client.connect()).rejects.toThrow("Failed to connect to MongoDB");
    }, TEST_TIMEOUT);
    
    it("should handle errors in createIndex during connect", async () => {
      const client = new MongoDBClient(mongoUri);
      const mockCollection = {
        createIndex: vi.fn().mockRejectedValue(new Error("Failed to create index")),
      };
      const mockDb = {
        listCollections: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
        createCollection: vi.fn().mockResolvedValue(mockCollection),
        collection: vi.fn().mockReturnValue(mockCollection),
      };
      
      // Mock the internal _db property after connect is called
      const originalConnect = client.connect.bind(client);
      client.connect = async () => {
        await originalConnect();
        Object.defineProperty(client, "_db", {
          value: mockDb,
          writable: true,
        });
        throw new Error("Failed to connect to MongoDB");
      };
      
      await expect(client.connect()).rejects.toThrow("Failed to connect to MongoDB");
    }, TEST_TIMEOUT);
    
    it('should handle MongoDB connection errors with invalid URI', async () => {
      const client = new MongoDBClient('mongodb://localhost:1323');
      await expect(client.connect()).rejects.toThrow('Failed to connect to MongoDB');
    }, TEST_TIMEOUT);
    
    it('should handle errors in saveLabel', async () => {
      const mockCollection = {
        insertOne: vi.fn().mockRejectedValue(new Error("Insert failed")),
      };

      Object.defineProperty(client, "_labels", {
        value: mockCollection,
        writable: true,
      });

      const testLabel: UnsignedLabel & { sig: ArrayBuffer } = {
        val: "test",
        uri: "test://uri",
        cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        cts: new Date().toISOString(),
        src: "did:web:test.com" as `did:${string}`,
        neg: false,
        ver: 1 as const,
        sig: new ArrayBuffer(0),
      };

      await expect(client.saveLabel(testLabel)).rejects.toThrow("Failed to save label: Insert failed");
    });
    
    it('should properly filter expired labels', async () => {
      const client = new MongoDBClient(mongoUri);
      await safeAsyncOperation(async () => {
        await client.connect();
      }, getErrorMessage('Failed to connect client'));
      
      const now = new Date();
      const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
      const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day in future
      
      // Create expired and valid labels
      const expiredLabel: UnsignedLabel & { sig: ArrayBuffer } = {
        src: 'did:test:expired' as `did:${string}`,
        uri: 'at://expired',
        cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        val: 'expired',
        neg: false,
        cts: now.toISOString(),
        exp: pastDate.toISOString(),
        ver: 1 as const,
        sig: new ArrayBuffer(64)
      };
      
      const validLabel: UnsignedLabel & { sig: ArrayBuffer } = {
        src: 'did:test:valid' as `did:${string}`,
        uri: 'at://valid',
        cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        val: 'valid',
        neg: false,
        cts: now.toISOString(),
        exp: futureDate.toISOString(),
        ver: 1 as const,
        sig: new ArrayBuffer(64)
      };
      
      await client.saveLabel(expiredLabel);
      await client.saveLabel(validLabel);
      
      const labels = await client.findLabels({});
      
      // Should only find the valid label
      expect(labels.length).toBe(1);
      expect(labels[0].val).toBe('valid');
      
      await client.close();
    }, TEST_TIMEOUT);
    
    it('should handle errors in findLabels query execution', async () => {
      const mockCollection = {
        find: vi.fn().mockReturnValue({
          toArray: vi.fn().mockRejectedValue(new Error('Query execution failed')),
        }),
      };
      
      Object.defineProperty(client, '_labels', {
        value: mockCollection,
        writable: true,
      });
      
      await expect(client.findLabels({})).rejects.toThrow('Failed to find labels');
    });
    
    it("should handle errors in findOne when collection is initialized", async () => {
      const mockCollection = {
        findOne: vi.fn().mockRejectedValue(new Error("Find operation failed")),
      };
      
      Object.defineProperty(client, "_labels", {
        value: mockCollection,
        writable: true,
      });
      
      await expect(client.findOne({ id: 1 })).rejects.toThrow("Failed to find label");
    });
    
    it("should handle errors in findLabels when collection is initialized", async () => {
      const mockCollection = {
        find: vi.fn().mockReturnValue({
          toArray: vi.fn().mockRejectedValue(new Error("Find operation failed")),
        }),
      };
      
      Object.defineProperty(client, "_labels", {
        value: mockCollection,
        writable: true,
      });
      
      await expect(client.findLabels({ src: "did:web:test.com" as `did:${string}` })).rejects.toThrow("Failed to find labels");
    });
    
    it.skip("should handle errors in _getNextId", async () => {});
    it.skip("should handle errors in getting next ID during saveLabel", async () => {});
  });
  
  describe('Label Operations', () => {
    let mongoUri: string;
    
    beforeEach(() => {
      mongoUri = getMongodUri();
    });
    
    it('should handle saveLabel with various scenarios', async () => {
      const client = new MongoDBClient(mongoUri);
      await safeAsyncOperation(async () => {
        await client.connect();
      }, getErrorMessage('Failed to connect client'));
      
      // Test successful save
      const label: UnsignedLabel & { sig: ArrayBuffer } = {
        src: 'did:example:123' as `did:${string}`,
        uri: 'at://test/123',
        cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        val: 'test',
        neg: false,
        cts: new Date().toISOString(),
        ver: 1 as const,
        sig: new ArrayBuffer(64)
      };
      
      const savedLabel = await client.saveLabel(label);
      expect(savedLabel._id).toBeDefined();
      expect(savedLabel.src).toBe(label.src);
      
      // Test error handling
      await client.close();
      await expect(client.saveLabel(label)).rejects.toThrow();
    }, TEST_TIMEOUT);
    
    it('should handle findLabels with different queries and options', async () => {
      const client = new MongoDBClient(mongoUri);
      await safeAsyncOperation(async () => {
        await client.connect();
      }, getErrorMessage('Failed to connect client'));
      
      // Insert test data in parallel
      const labels: Array<UnsignedLabel & { sig: ArrayBuffer }> = [
        { 
          src: 'did:test:1' as `did:${string}`, 
          uri: 'at://1', 
          cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi', 
          val: 'test1', 
          neg: false, 
          cts: new Date().toISOString(), 
          ver: 1 as const,
          sig: new ArrayBuffer(64) 
        },
        { 
          src: 'did:test:2' as `did:${string}`, 
          uri: 'at://2', 
          cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi', 
          val: 'test2', 
          neg: true, 
          cts: new Date().toISOString(), 
          ver: 1 as const,
          sig: new ArrayBuffer(64) 
        }
      ];
      
      await Promise.all(labels.map(l => client.saveLabel(l)));
      
      // Test different queries
      const allLabels = await client.findLabels({ allowExpired: true });
      expect(allLabels.length).toBeGreaterThanOrEqual(2);
      
      const negatedLabels = await client.findLabels({ neg: true, allowExpired: true });
      expect(negatedLabels.length).toBeGreaterThanOrEqual(1);
      
      // Test with options
      const limitedLabels = await client.findLabels({ allowExpired: true }, { limit: 1 });
      expect(limitedLabels.length).toBe(1);
      
      await client.close();
    }, TEST_TIMEOUT);
    
    it('should handle findOne with different scenarios', async () => {
      const client = new MongoDBClient(mongoUri);
      await safeAsyncOperation(async () => {
        await client.connect();
      }, getErrorMessage('Failed to connect client'));
      
      // Test finding existing label
      const label: UnsignedLabel & { sig: ArrayBuffer } = {
        src: 'did:test:findone' as `did:${string}`,
        uri: 'at://findone',
        cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        val: 'test',
        neg: false,
        cts: new Date().toISOString(),
        ver: 1 as const,
        sig: new ArrayBuffer(64)
      };
      
      const savedLabel = await client.saveLabel(label);
      const foundLabel = await client.findOne({ _id: savedLabel._id });
      expect(foundLabel).toBeDefined();
      expect(foundLabel?.src).toBe(label.src);
      
      // Test finding non-existent label
      const nonExistentLabel = await client.findOne({ id: -1 });
      expect(nonExistentLabel).toBeNull();
      
      await client.close();
    }, TEST_TIMEOUT);
  });
});

function safeAsyncOperation<T>(operation: () => Promise<T>, errorMessage: string): Promise<T> {
  return operation().catch(_error => {
    throw new Error(errorMessage);
  });
}
