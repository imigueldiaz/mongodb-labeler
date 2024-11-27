import { type Collection, MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { LabelerServer } from "../LabelerServer";
import type { LabelerOptions } from "../LabelerServer.js";
import type { SavedLabel, UnsignedLabel, CreateLabelData } from "../util/types.js";

const TEST_TIMEOUT = 35000;
const SETUP_TIMEOUT = 120000; // 2 minutos para la descarga del servidor

describe("LabelerServer", () => {
  let mongoServer: MongoMemoryServer;
  let connection: MongoClient;
  let collection: Collection<SavedLabel>;
  let server: LabelerServer;
  const options: LabelerOptions = {
    did: "did:web:test.com",
    signingKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    mongoUri: "",
    databaseName: "test",
    collectionName: "labels",
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    options.mongoUri = mongoServer.getUri();
    connection = await MongoClient.connect(options.mongoUri);
    collection = connection.db("test").collection("labels");
  }, SETUP_TIMEOUT);

  afterAll(async () => {
    if (connection instanceof MongoClient) {
      await connection.close();
    }
    if (mongoServer instanceof MongoMemoryServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    try {
      // Drop the collection to ensure a clean state
      await collection.drop().catch(() => {/* ignore if collection doesn't exist */});

      // Ping the database to check connection
      await connection.db().admin().ping();
    } catch (error) {
      // Reconnect if ping fails
      const uri = mongoServer.getUri();
      connection = await MongoClient.connect(uri);
      collection = connection.db("test").collection("labels");
    }

    // Create a new server instance with a fresh connection
    server = new LabelerServer(options);

    // Wait for both MongoDB connection and signer initialization
    await server.db.connect();
    await server.getInitializationPromise();
  });

  afterEach(async () => {
    // Clean up the database after each test
    await collection.drop().catch(() => {/* ignore if collection doesn't exist */});
    await server.close();
  });

  describe("MongoDB Operations", () => {
    // Increase timeout for MongoDB operations
    jest.setTimeout(120000); // 2 minutes

    it("should handle invalid MongoDB URI", () => {
      expect(() =>
        new LabelerServer({
          ...options,
          mongoUri: "invalid-uri",
        })
      ).toThrow(
        "Invalid server configuration: Invalid scheme, expected connection string to start with \"mongodb://\" or \"mongodb+srv://\"",
      );
    }, TEST_TIMEOUT);

    it("should handle connection failures", async () => {
      const failingServer = new LabelerServer({
        ...options,
        mongoUri: "mongodb://invalid-host:27017",
      });

      await expect(failingServer.db.connect()).rejects.toThrow("Failed to connect to MongoDB");
    }, TEST_TIMEOUT);

    it("should handle connection string validation", () => {
      expect(() =>
        new LabelerServer({
          ...options,
          mongoUri: "",
        })
      ).toThrow("Invalid server configuration: Missing required parameter: mongoUri");
    });

    it("should handle errors in close", async () => {
      // Mock the MongoDBClient's close method to fail
      const mockClose = jest.fn().mockRejectedValueOnce(new Error("Close failed"));
      const originalClose = server.db.close.bind(server.db);
      server.db.close = mockClose;

      await expect(async () => {
        await server.close();
      }).rejects.toThrow("Failed to close database connection");

      // Verify mock was called
      expect(mockClose).toHaveBeenCalled();

      // Restore original method
      server.db.close = originalClose;
    });
  });

  describe("Server Initialization", () => {
    it("should handle different configurations", async () => {
      // Test with minimum required options
      const minServer = new LabelerServer({
        did: 'did:example:123',
        signingKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        mongoUri: 'mongodb://localhost:27017'
      });
      
      await expect(minServer.getInitializationPromise()).resolves.not.toThrow();
      
      // Test with custom database and collection names
      const customServer = new LabelerServer({
        did: 'did:example:123',
        signingKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        mongoUri: 'mongodb://localhost:27017',
        databaseName: 'custom_db',
        collectionName: 'custom_labels'
      });
      
      await expect(customServer.getInitializationPromise()).resolves.not.toThrow();
    });

    it("should handle invalid configurations", async () => {
      // Test with invalid signing key
      await expect(async () => {
        const server = new LabelerServer({
          did: 'did:example:123',
          signingKey: 'invalid_key',
          mongoUri: 'mongodb://localhost:27017'
        });
        await server.getInitializationPromise();
      }).rejects.toThrow();
      
      // Test with missing required parameters
      await expect(async () => {
        const server = new LabelerServer({
          did: 'did:example:123',
          signingKey: '',
          mongoUri: 'mongodb://localhost:27017'
        });
        await server.getInitializationPromise();
      }).rejects.toThrow();
    });
  });

  describe("Label Operations", () => {
    it("should create label with expiration", async () => {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + 1); // Set expiration to tomorrow

      const testLabel: Omit<UnsignedLabel, "cts"> = {
        val: "test",
        uri: "at://did:web:test.com/app.bsky.feed.post/test",
        cid: "bafyreie5cvv4h45feadlkyw2b2jmkrxhiwdwvqokkf7k3tvtc3xqbrnx7y",
        neg: false,
        src: "did:web:test.com",
        exp: expDate.toISOString(),
      };

      const labelWithExp = await server.createLabel(testLabel);
      expect(labelWithExp.exp).toBe(expDate.toISOString());
    }, TEST_TIMEOUT);

    it("should handle invalid label data", async () => {
      const invalidLabel: Omit<UnsignedLabel, "cts"> = {
        val: "",
        uri: "invalid-uri",
        cid: "invalid-cid",
        neg: false,
        src: "did:web:test.com",
      };

      await expect(server.createLabel(invalidLabel)).rejects.toThrow();
    }, TEST_TIMEOUT);

    describe("Label Negation", () => {
      const mockLabel: SavedLabel = {
        id: 1,
        val: "test-label",
        uri: "at://test.com",
        cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        neg: false,
        src: "did:web:test.com",
        cts: new Date().toISOString(),
        sig: new ArrayBuffer(64),
      };

      it("should reverse label negation", async () => {
        jest.spyOn(server.db, "findLabels").mockResolvedValue([mockLabel]);
        jest.spyOn(server.db, "updateLabel").mockResolvedValue(true);

        const result = await server.reverseLabelNegation(1, true);
        expect(result).not.toBeNull();
        expect(result?.neg).toBe(true);
      });

      it("should handle non-existent label in reverseLabelNegation", async () => {
        jest.spyOn(server.db, "findLabels").mockResolvedValue([]);

        const result = await server.reverseLabelNegation(999);
        expect(result).toBeNull();
      });

      it("should handle database error in reverseLabelNegation", async () => {
        jest.spyOn(server.db, "findLabels").mockRejectedValue(new Error("Failed to reverse label negation"));

        await expect(server.reverseLabelNegation(1)).rejects.toThrow("Failed to reverse label negation");
      });
    });
  });

  describe("Label Expiration", () => {
    it("should handle expired labels correctly", async () => {
      // Create a label with an expiration date in the future
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1); // Set expiration to tomorrow
      
      const labelData: CreateLabelData = {
        uri: "at://test.com/123",
        cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        val: "test-future",
        neg: false,
        exp: futureDate.toISOString()
      };
      
      // Create the label
      const validLabel = await server.createLabel(labelData);
      expect(validLabel).toBeDefined();
      expect(validLabel.exp).toBe(futureDate.toISOString());
      
      // Verify it's queryable
      let labels = await server.queryLabels();
      expect(labels.length).toBe(1);
      expect(labels[0].exp).toBe(futureDate.toISOString());
      
      // Now try to create a label with a past expiration date
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // Set expiration to yesterday
      
      const expiredLabelData: CreateLabelData = {
        ...labelData,
        uri: "at://test.com/456",
        val: "test-expired",
        exp: pastDate.toISOString()
      };
      
      // Should throw when trying to create an expired label without allowExpired
      await expect(server.createLabel(expiredLabelData)).rejects.toThrow("Label validation failed: Expiration timestamp must be in the future");
      
      // Should be able to create expired label with allowExpired
      const expiredLabel = await server.createLabel(expiredLabelData, true);
      expect(expiredLabel).toBeDefined();
      expect(expiredLabel.exp).toBe(pastDate.toISOString());
      
      // Query should return both labels when allowExpired is true
      labels = await server.queryLabels({ allowExpired: true });
      expect(labels.length).toBe(2);
      expect(labels.some(l => l.exp === futureDate.toISOString())).toBe(true);
      expect(labels.some(l => l.exp === pastDate.toISOString())).toBe(true);
      
      // Query should only return non-expired label by default
      labels = await server.queryLabels();
      expect(labels.length).toBe(1);
      expect(labels[0].exp).toBe(futureDate.toISOString());
    });

    it("should handle expired labels in queryLabels", async () => {
      // Create a label with an expiration date in the future
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1); // Set expiration to tomorrow
      
      const validLabel = await server.createLabel({
        uri: "at://test.com/123",
        cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        val: "test-future",
        neg: false,
        exp: futureDate.toISOString()
      });

      // Create an expired label
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // Set expiration to yesterday
      
      const expiredLabel = await server.createLabel({
        uri: "at://test.com/456",
        cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        val: "test-expired",
        neg: false,
        exp: pastDate.toISOString()
      }, true);

      // Query with specific expiration date should work with allowExpired
      let labels = await server.queryLabels({ exp: pastDate.toISOString(), allowExpired: true });
      expect(labels.length).toBe(1);
      expect(labels[0].exp).toBe(pastDate.toISOString());

      // Query with future expiration date should work
      labels = await server.queryLabels({ exp: futureDate.toISOString() });
      expect(labels.length).toBe(1);
      expect(labels[0].exp).toBe(futureDate.toISOString());

      // Query with past expiration date should throw without allowExpired
      await expect(server.queryLabels({ exp: pastDate.toISOString() }))
        .rejects.toThrow("Label validation failed: Expiration timestamp must be in the future");
    });
  });

  describe("Additional Tests", () => {
    // Helper function to create a server instance
    async function createServer(): Promise<LabelerServer> {
      const server = new LabelerServer(options);
      await server.db.connect();
      return server;
    }

    it('should handle label validation errors', async () => {
      const server = await createServer();
      await server.getInitializationPromise();

      const invalidLabel = {
        val: 'test',
        uri: 'invalid-uri', // Invalid URI format
        cid: 'invalid-cid', // Invalid CID format
        src: 'did:test:123' as `did:${string}`,
      };

      await expect(server.createLabel(invalidLabel)).rejects.toThrow('Label validation failed: Invalid AT Protocol URI: must start with "at://"');
    });

    it('should handle initialization errors', async () => {
      const invalidConfig: LabelerOptions = {
        ...options,
        signingKey: 'invalid-key'
      };

      const server = new LabelerServer(invalidConfig);
      await expect(server.getInitializationPromise()).rejects.toThrow('Failed to initialize signer');
    });

    it('should handle database errors in label operations', async () => {
      const server = await createServer();
      await server.getInitializationPromise();

      // Mock database error
      const mockDb = {
        findOne: jest.fn().mockRejectedValue(new Error('Database error')),
        findLabels: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      Object.defineProperty(server, 'db', {
        value: mockDb,
        writable: true,
        configurable: true
      });

      // Test queryLabel
      await expect(server.queryLabels()).rejects.toThrow('Failed to query labels');

      // Test queryLabels
      await expect(server.queryLabels()).rejects.toThrow('Failed to query labels');

      // Test deleteLabel
      await expect(server.deleteLabel(1)).rejects.toThrow('Failed to delete label');
    });

    it('should handle errors in reverseLabelNegation', async () => {
      const server = await createServer();
      await server.getInitializationPromise();

      // Test with non-existent label
      const result = await server.reverseLabelNegation(999);
      expect(result).toBeNull();

      // Test with database error
      const mockDb = {
        findOne: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      Object.defineProperty(server, 'db', {
        value: mockDb,
        writable: true,
        configurable: true
      });

      await expect(server.reverseLabelNegation(1)).rejects.toThrow('Failed to reverse label negation');
    });

    it("should handle non-array response in queryLabels", async () => {
      const server = await createServer();
      await server.getInitializationPromise();

      // Mock findLabels to return a non-array value
      jest.spyOn(server.db, "findLabels").mockResolvedValue({} as unknown as Promise<SavedLabel[]>);

      await expect(server.queryLabels()).rejects.toThrow("Failed to query labels");
    });

    it("should handle signing failures in createLabel", async () => {
      const server = await createServer();
      await server.getInitializationPromise();

      // Mock the signer to fail
      Object.defineProperty(server, "_signer", {
        value: {
          sign: jest.fn().mockRejectedValue(new Error("Signing failed")),
        },
        writable: true,
      });

      const validLabel: CreateLabelData = {
        val: "test",
        uri: "at://user.bsky.social/app.bsky.feed.post/3jxtb5w2g622y",
        cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        neg: false,
      };

      await expect(server.createLabel(validLabel)).rejects.toThrow("Failed to create label");
    });

    it("should handle errors when saving negated label in deleteLabel", async () => {
      const server = await createServer();
      await server.getInitializationPromise();

      // Mock findOne to return a label and saveLabel to fail
      jest.spyOn(server.db, "findOne").mockResolvedValue({
        id: 1,
        val: "test",
        uri: "at://test.com",
        cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        neg: false,
        cts: new Date().toISOString(),
        src: "did:web:test.com",
        sig: new ArrayBuffer(0),
      });

      jest.spyOn(server.db, "saveLabel").mockRejectedValue(new Error("Save failed"));

      await expect(server.deleteLabel(1)).rejects.toThrow("Failed to save negated label to database");
    });

    it("should handle errors when signing negated label in deleteLabel", async () => {
      const server = await createServer();
      await server.getInitializationPromise();

      // Mock findOne to return a label and signer to fail
      jest.spyOn(server.db, "findOne").mockResolvedValue({
        id: 1,
        val: "test",
        uri: "at://test.com",
        cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        neg: false,
        cts: new Date().toISOString(),
        src: "did:web:test.com",
        sig: new ArrayBuffer(0),
      });

      Object.defineProperty(server, "_signer", {
        value: {
          sign: jest.fn().mockRejectedValue(new Error("Signing failed")),
        },
        writable: true,
      });

      await expect(server.deleteLabel(1)).rejects.toThrow("Failed to delete label");
    });
  });
});
