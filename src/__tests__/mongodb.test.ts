import { MongoDBClient } from "../mongodb.js";
import type { UnsignedLabel } from "../util/types.js";
import { MongoMemoryServer } from 'mongodb-memory-server';

const TEST_TIMEOUT = 35000;

describe("MongoDBClient", () => {
  describe("MongoDB Operations", () => {
    let mongoServer: MongoMemoryServer;
    let mongoUri: string;
    let client: MongoDBClient;
    
    beforeEach(async () => {
      // Create the MongoDB Memory Server instance
      mongoServer = await MongoMemoryServer.create();
      mongoUri = mongoServer.getUri();
      client = new MongoDBClient(mongoUri);
      // Ensure client is connected before tests
      await client.connect();
    });
    
    afterEach(async () => {
      // Explicitly close the MongoDB client
      if (client) {
        await client.close().catch(console.error);
      }
      // Ensure MongoDB server is stopped
      if (mongoServer) {
        await mongoServer.stop({ doCleanup: true }).catch(console.error);
      }
    });
    
    // After all tests in this describe block
    afterAll(async () => {
      try {
        // Ensure client connection is closed
        if (client) {
          await client.close();
        }
        
        // Final server cleanup
        if (mongoServer) {
          await mongoServer.stop();
        }
        
        // Allow a small delay for cleanup operations to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Error during final cleanup:', error instanceof Error ? error.message : String(error));
      }
    });
    it("should handle errors in updateLabel", async () => {
      const client = new MongoDBClient(mongoUri);
      const mockCollection = {
        updateOne: jest.fn().mockRejectedValue(new Error("Update failed")),
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
        sig: new ArrayBuffer(0),
      };
      
      await expect(client.updateLabel(1, testLabel)).rejects.toThrow("Failed to update label");
    });
    
    it("should handle errors in getLabelsAfterCursor", async () => {
      const client = new MongoDBClient(mongoUri);
      const mockCollection = {
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              toArray: jest.fn().mockRejectedValue(new Error("Failed to get labels after cursor")),
            }),
          }),
        }),
      };
      
      Object.defineProperty(client, "_labels", {
        value: mockCollection,
        writable: true,
      });
      
      await expect(client.getLabelsAfterCursor(0, 10)).rejects.toThrow("Failed to get labels after cursor");
    });
    
    it("should handle uninitialized collection in operations", async () => {
      const client = new MongoDBClient(mongoUri);
      
      await expect(client.findLabels({})).resolves.toEqual([]);
      await expect(client.findOne({})).resolves.toBeNull();
      await expect(client.getLabelsAfterCursor(0, 10)).resolves.toEqual([]);
    });
    
    it("should handle first label creation with _getNextId", async () => {
      const client = new MongoDBClient(mongoUri);
      const mockCollection = {
        findOne: jest.fn().mockResolvedValue(null),
        insertOne: jest.fn().mockResolvedValue({ acknowledged: true }),
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
        sig: new ArrayBuffer(0),
      };
      
      await expect(client.saveLabel(testLabel)).resolves.toHaveProperty("id", 1);
    });
    
    it("should handle errors in listCollections during connect", async () => {
      const client = new MongoDBClient(mongoUri);
      const mockDb = {
        listCollections: jest.fn().mockReturnValue({
          toArray: jest.fn().mockRejectedValue(new Error("Failed to list collections")),
        }),
        collection: jest.fn(),
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
        createIndex: jest.fn().mockRejectedValue(new Error("Failed to create index")),
      };
      const mockDb = {
        listCollections: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([]),
        }),
        createCollection: jest.fn().mockResolvedValue(mockCollection),
        collection: jest.fn().mockReturnValue(mockCollection),
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
      const client = new MongoDBClient('mongodb://invalid:27017');
      await expect(client.connect()).rejects.toThrow('Failed to connect to MongoDB');
    }, TEST_TIMEOUT);
    
    it('should handle errors in _getNextId', async () => {
      const client = new MongoDBClient(mongoUri);
      const mockCollection = {
        findOne: jest.fn().mockRejectedValue(new Error('Database error')),
      };
      
      Object.defineProperty(client, '_labels', {
        value: mockCollection,
        writable: true,
      });
      
      const testLabel: UnsignedLabel & { sig: ArrayBuffer } = {
        val: 'test',
        uri: 'test://uri',
        cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        cts: new Date().toISOString(),
        src: 'did:web:test.com' as `did:${string}`,
        neg: false,
        sig: new ArrayBuffer(0),
      };
      
      await expect(client.saveLabel(testLabel)).rejects.toThrow('Failed to get next ID');
    });
    
    it('should properly filter expired labels', async () => {
      const client = new MongoDBClient(mongoUri);
      await client.connect();
      
      const now = new Date();
      const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
      const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day in future
      
      // Create expired and valid labels
      const expiredLabel = {
        src: 'did:test:expired' as `did:${string}`,
        uri: 'at://expired',
        cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        val: 'expired',
        neg: false,
        cts: now.toISOString(),
        exp: pastDate.toISOString(),
        sig: new ArrayBuffer(64)
      };
      
      const validLabel = {
        src: 'did:test:valid' as `did:${string}`,
        uri: 'at://valid',
        cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        val: 'valid',
        neg: false,
        cts: now.toISOString(),
        exp: futureDate.toISOString(),
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
      const client = new MongoDBClient(mongoUri);
      const mockCollection = {
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockRejectedValue(new Error('Query execution failed')),
        }),
      };
      
      Object.defineProperty(client, '_labels', {
        value: mockCollection,
        writable: true,
      });
      
      await expect(client.findLabels({})).rejects.toThrow('Failed to find labels');
    });
    
    it("should handle errors in findOne when collection is initialized", async () => {
      const client = new MongoDBClient(mongoUri);
      const mockCollection = {
        findOne: jest.fn().mockRejectedValue(new Error("Find operation failed")),
      };
      
      Object.defineProperty(client, "_labels", {
        value: mockCollection,
        writable: true,
      });
      
      await expect(client.findOne({ id: 1 })).rejects.toThrow("Failed to find label");
    });
    
    it("should handle errors in findLabels when collection is initialized", async () => {
      const client = new MongoDBClient(mongoUri);
      const mockCollection = {
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockRejectedValue(new Error("Find operation failed")),
        }),
      };
      
      Object.defineProperty(client, "_labels", {
        value: mockCollection,
        writable: true,
      });
      
      await expect(client.findLabels({ src: "did:web:test.com" as `did:${string}` })).rejects.toThrow("Failed to find labels");
    });
    
    it("should handle errors in saveLabel collection operation", async () => {
      const client = new MongoDBClient(mongoUri);
      const mockCollection = {
        findOne: jest.fn().mockResolvedValue({ id: 1 }),
        insertOne: jest.fn().mockRejectedValue(new Error("Insert failed")),
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
        sig: new ArrayBuffer(0),
      };
      
      await expect(client.saveLabel(testLabel)).rejects.toThrow("Failed to save label");
    });
    
    it("should handle errors in getting next ID during saveLabel", async () => {
      const client = new MongoDBClient(mongoUri);
      const mockCollection = {
        findOne: jest.fn().mockRejectedValue(new Error("Find operation failed")),
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
        sig: new ArrayBuffer(0),
      };
      
      await expect(client.saveLabel(testLabel)).rejects.toThrow("Failed to get next ID");
    });
  });
  
  describe('Label Operations', () => {
    let mongoServer: MongoMemoryServer;
    let mongoUri: string;
    
    beforeEach(async () => {
      mongoServer = await MongoMemoryServer.create();
      mongoUri = mongoServer.getUri();
    });
    
    afterEach(async () => {
      await mongoServer.stop();
    });
    
    it('should handle saveLabel with various scenarios', async () => {
      const client = new MongoDBClient(mongoUri);
      await client.connect();
      
      // Test successful save
      const label = {
        src: 'did:example:123' as `did:${string}`,
        uri: 'at://test/123',
        cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        val: 'test',
        neg: false,
        cts: new Date().toISOString(),
        sig: new ArrayBuffer(64)
      };
      
      const savedLabel = await client.saveLabel(label);
      expect(savedLabel.id).toBeDefined();
      expect(savedLabel.src).toBe(label.src);
      
      // Test error handling
      await client.close();
      await expect(client.saveLabel(label)).rejects.toThrow();
    }, TEST_TIMEOUT);
    
    it('should handle findLabels with different queries and options', async () => {
      const client = new MongoDBClient(mongoUri);
      await client.connect();
      
      // Insert test data
      const labels = [
        { 
          src: 'did:test:1' as `did:${string}`, 
          uri: 'at://1', 
          cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi', 
          val: 'test1', 
          neg: false, 
          cts: new Date().toISOString(), 
          sig: new ArrayBuffer(64) 
        },
        { 
          src: 'did:test:2' as `did:${string}`, 
          uri: 'at://2', 
          cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi', 
          val: 'test2', 
          neg: true, 
          cts: new Date().toISOString(), 
          sig: new ArrayBuffer(64) 
        }
      ];
      
      await Promise.all(labels.map(l => client.saveLabel(l)));
      
      // Test different queries
      const allLabels = await client.findLabels({});
      expect(allLabels.length).toBeGreaterThanOrEqual(2);
      
      const negatedLabels = await client.findLabels({ neg: true });
      expect(negatedLabels.length).toBeGreaterThanOrEqual(1);
      
      // Test with options
      const limitedLabels = await client.findLabels({}, { limit: 1 });
      expect(limitedLabels.length).toBe(1);
      
      await client.close();
    }, TEST_TIMEOUT);
    
    it('should handle findOne with different scenarios', async () => {
      const client = new MongoDBClient(mongoUri);
      await client.connect();
      
      // Test finding existing label
      const label = {
        src: 'did:test:findone' as `did:${string}`,
        uri: 'at://findone',
        cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        val: 'test',
        neg: false,
        cts: new Date().toISOString(),
        sig: new ArrayBuffer(64)
      };
      
      const savedLabel = await client.saveLabel(label);
      const foundLabel = await client.findOne({ id: savedLabel.id });
      expect(foundLabel).toBeDefined();
      expect(foundLabel?.src).toBe(label.src);
      
      // Test finding non-existent label
      const nonExistentLabel = await client.findOne({ id: -1 });
      expect(nonExistentLabel).toBeNull();
      
      await client.close();
    }, TEST_TIMEOUT);
  });
});
