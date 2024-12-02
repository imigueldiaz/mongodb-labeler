import { type Collection, MongoClient, ObjectId } from "mongodb";
import { LabelerServer } from "../LabelerServer";
import type { LabelerOptions } from "../LabelerServer.js";
import type { SavedLabel, UnsignedLabel, CreateLabelData } from "../util/types.js";
import { getMongodUri } from "../../vitest.setup";
import { safeAsyncOperation, getErrorMessage } from "../util/errorUtils";
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
const TEST_TIMEOUT = 35000;
const SETUP_TIMEOUT = 120000; // 2 minutos para la descarga del servidor

describe("LabelerServer", () => {
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
    await safeAsyncOperation(async () => {
      options.mongoUri = getMongodUri();
      connection = await MongoClient.connect(options.mongoUri);
      collection = connection.db("test").collection("labels");
    }, getErrorMessage('Failed to initialize test environment'));
  }, SETUP_TIMEOUT);

  afterAll(async () => {
    await safeAsyncOperation(async () => {
      await Promise.all([
        server?.close(),
        connection?.close(true)
      ]);
    }, getErrorMessage('Error during test cleanup'));
  });

  afterEach(async () => {
    await safeAsyncOperation(async () => {
      await Promise.all([
        collection?.drop().catch(() => {/* ignore if collection doesn't exist */}),
        server?.close()
      ]);
    }, getErrorMessage('Error during test cleanup'));
  });

  beforeEach(async () => {
    await safeAsyncOperation(async () => {
      await collection.drop().catch(() => {/* ignore if collection doesn't exist */});
      await connection.db().admin().ping();
    }, getErrorMessage('Failed to prepare test')).catch(async () => {
      // Reconnect if ping fails
      connection = await MongoClient.connect(options.mongoUri);
      collection = connection.db("test").collection("labels");
    });

    // Create a new server instance with a fresh connection
    server = new LabelerServer(options);
    await Promise.all([
      server.db.connect(),
      server.getInitializationPromise()
    ]);
  });

  describe("MongoDB Operations", () => {
    // Increase timeout for MongoDB operations


    it("should handle invalid MongoDB URI", async () => {
      await safeAsyncOperation(async () => {
        expect(() =>
          new LabelerServer({
            ...options,
            mongoUri: "invalid-uri",
          })
        ).toThrow(
          "Invalid server configuration: Invalid scheme, expected connection string to start with \"mongodb://\" or \"mongodb+srv://\"",
        );
      }, getErrorMessage('Failed to test invalid MongoDB URI'));
    }, TEST_TIMEOUT);

    it("should handle connection failures", async () => {
      await safeAsyncOperation(async () => {
        const failingServer = new LabelerServer({
          ...options,
          mongoUri: "mongodb://invalid-host:27017",
        });

        await expect(failingServer.db.connect()).rejects.toThrow("Failed to connect to MongoDB");
      }, getErrorMessage('Failed to test connection failures'));
    }, TEST_TIMEOUT);

    it("should handle connection string validation", async () => {
      await safeAsyncOperation(async () => {
        expect(() =>
          new LabelerServer({
            ...options,
            mongoUri: "",
          })
        ).toThrow("Invalid server configuration: Missing required parameter: mongoUri");
      }, getErrorMessage('Failed to test connection string validation'));
    });

    it("should handle errors in close", async () => {
      await safeAsyncOperation(async () => {
        // Mock the MongoDBClient's close method to fail
        const mockClose = vi.fn().mockRejectedValueOnce(new Error("Close failed"));
        const originalClose = server.db.close.bind(server.db);
        server.db.close = mockClose;

        await expect(async () => {
          await server.close();
        }).rejects.toThrow("Failed to close database connection");

        // Verify mock was called
        expect(mockClose).toHaveBeenCalled();

        // Restore original method
        server.db.close = originalClose;
      }, getErrorMessage('Failed to test errors in close'));
    });
  });

  describe("Server Initialization", () => {
    it("should handle different configurations", async () => {
      await safeAsyncOperation(async () => {
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
      }, getErrorMessage('Failed to test different configurations'));
    });

    it("should handle invalid configurations", async () => {
      await safeAsyncOperation(async () => {
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
      }, getErrorMessage('Failed to test invalid configurations'));
    });
  });

  describe("Label Operations", () => {
    it("should create label with expiration", async () => {
      await safeAsyncOperation(async () => {
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + 1); // Set expiration to tomorrow

        const testLabel: Omit<UnsignedLabel, "cts"> = {
          ver: 1,
          val: "test",
          uri: "at://did:web:test.com/app.bsky.feed.post/test",
          cid: "bafyreie5cvv4h45feadlkyw2b2jmkrxhiwdwvqokkf7k3tvtc3xqbrnx7y",
          neg: false,
          src: "did:web:test.com",
          exp: expDate.toISOString(),
        };

        const labelWithExp = await server.createLabel(testLabel);
        expect(labelWithExp.exp).toBe(expDate.toISOString());
      }, getErrorMessage('Failed to create label with expiration'));
    }, TEST_TIMEOUT);

    it("should validate URI and CID relationship correctly", async () => {
      await safeAsyncOperation(async () => {
        // Test DID URI without CID (should work)
        const didLabel: CreateLabelData = {
          ver: 1,
          val: "test",
          uri: "did:web:test.com",
        };
        await expect(server.createLabel(didLabel)).resolves.toBeDefined();

        // Test DID URI with CID (should fail)
        const didWithCidLabel: CreateLabelData = {
          ver: 1,
          val: "test",
          uri: "did:web:test.com",
          cid: "bafyreie5cvv4h45feadlkyw2b2jmkrxhiwdwvqokkf7k3tvtc3xqbrnx7y",
        };
        await expect(server.createLabel(didWithCidLabel)).rejects.toThrow("CID cannot be provided for DID URIs");

        // Test AT URI with CID (should work)
        const atWithCidLabel: CreateLabelData = {
          ver: 1,
          val: "test",
          uri: "at://did:web:test.com/app.bsky.feed.post/test",
          cid: "bafyreie5cvv4h45feadlkyw2b2jmkrxhiwdwvqokkf7k3tvtc3xqbrnx7y",
        };
        await expect(server.createLabel(atWithCidLabel)).resolves.toBeDefined();

        // Test AT URI without CID (should work but log warning)
        const consoleSpy = vi.spyOn(console, 'warn');
        const atWithoutCidLabel: CreateLabelData = {
          ver: 1,
          val: "test",
          uri: "at://did:web:test.com/app.bsky.feed.post/test",
        };
        await expect(server.createLabel(atWithoutCidLabel)).resolves.toBeDefined();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Creating a label for an at:// URI without a CID'));
        consoleSpy.mockRestore();
      }, getErrorMessage('Failed to test URI and CID validation'));
    }, TEST_TIMEOUT);

    it("should handle invalid label data", async () => {
      await safeAsyncOperation(async () => {
        const invalidLabel: Omit<UnsignedLabel, "cts"> = {
          ver: 1,
          val: "",
          uri: "invalid-uri",
          cid: "invalid-cid",
          neg: false,
          src: "did:web:test.com",
        };

        await expect(server.createLabel(invalidLabel)).rejects.toThrow();
      }, getErrorMessage('Failed to handle invalid label data'));
    }, TEST_TIMEOUT);

    describe("Label Negation", () => {
      const mockLabel: SavedLabel = {
        _id: new ObjectId(),
        ver: 1,
        val: "test-label",
        uri: "at://test.com",
        cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        neg: false,
        src: "did:web:test.com",
        cts: new Date().toISOString(),
        sig: new ArrayBuffer(64),
      };

      it("should reverse label negation", async () => {
        await safeAsyncOperation(async () => {
          vi.spyOn(server.db, "findLabels").mockResolvedValue([mockLabel]);
          vi.spyOn(server.db, "updateLabel").mockResolvedValue(true);

          const result = await server.reverseLabelNegation(new ObjectId(), true);
          expect(result).not.toBeNull();
          expect(result?.neg).toBe(true);
        }, getErrorMessage('Failed to reverse label negation'));
      });

      it("should handle non-existent label in reverseLabelNegation", async () => {
        await safeAsyncOperation(async () => {
          vi.spyOn(server.db, "findLabels").mockResolvedValue([]);

          const result = await server.reverseLabelNegation(new ObjectId());
          expect(result).toBeNull();
        }, getErrorMessage('Failed to handle non-existent label in reverseLabelNegation'));
      });

      it("should handle database error in reverseLabelNegation", async () => {
        await safeAsyncOperation(async () => {
          vi.spyOn(server.db, "findLabels").mockRejectedValue(new Error("Failed to reverse label negation"));

          await expect(server.reverseLabelNegation(new ObjectId())).rejects.toThrow("Failed to reverse label negation");
        }, getErrorMessage('Failed to handle database error in reverseLabelNegation'));
      });
    });
  });

  describe("Label Expiration", () => {
    it("should handle expired labels correctly", async () => {
      await safeAsyncOperation(async () => {
        // Create a label with an expiration date in the future
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1); // Set expiration to tomorrow
        
        const labelData: CreateLabelData = {
          ver: 1,
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
          ver: 1,
          uri: "at://test.com/456",
          val: "test-expired",
          cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
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
      }, getErrorMessage('Failed to handle expired labels correctly'));
    });

    it("should handle expired labels in queryLabels", async () => {
      await safeAsyncOperation(async () => {
        // Create a label with an expiration date in the future
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1); // Set expiration to tomorrow
        
         await server.createLabel({
          ver: 1,
          uri: "at://test.com/123",
          cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
          val: "test-future",
          neg: false,
          exp: futureDate.toISOString()
        });

        // Create an expired label
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1); // Set expiration to yesterday
        
        await server.createLabel({
          ver: 1,
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
      }, getErrorMessage('Failed to handle expired labels in queryLabels'));
    });
  });

  describe("Label Version", () => {
    it("should require version 1", async () => {
      const invalidVersionLabel = {
        ver: 2,
        val: "test",
        uri: "at://user.bsky.social/app.bsky.feed.post/3jxtb5w2g622y",
        cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        neg: false,
      } as unknown as CreateLabelData;
      
      await expect(server.createLabel(invalidVersionLabel))
        .rejects.toThrow("Label validation failed: Label version must be 1");
      
      const missingVersionLabel = {
        val: "test",
        uri: "at://user.bsky.social/app.bsky.feed.post/3jxtb5w2g622y",
        cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        neg: false,
      } as unknown as CreateLabelData;
      
      await expect(server.createLabel(missingVersionLabel))
        .rejects.toThrow("Label validation failed: Label version must be 1");
    });
    
    it("should accept version 1", async () => {
      const validLabel = await server.createLabel({
        ver: 1,
        val: "test",
        uri: "at://user.bsky.social/app.bsky.feed.post/3jxtb5w2g622y",
        cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        neg: false,
      });
      expect(validLabel).toBeDefined();
      expect(validLabel.ver).toBe(1);
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
      await safeAsyncOperation(async () => {
        const server = await createServer();
        await server.getInitializationPromise();

        const invalidLabel: CreateLabelData = {
          ver: 1,
          val: "test",
          uri: "invalid-uri",
          cid: "invalid-cid",
        };

        await expect(server.createLabel(invalidLabel)).rejects.toThrow('Label validation failed: URI must start with either "did:" or "at://"');
      }, getErrorMessage('Failed to handle label validation errors'));
    });

    it('should handle initialization errors', async () => {
      await safeAsyncOperation(async () => {
        const invalidConfig: LabelerOptions = {
          ...options,
          signingKey: 'invalid-key'
        };

        const server = new LabelerServer(invalidConfig);
        await expect(server.getInitializationPromise()).rejects.toThrow('Failed to initialize signer');
      }, getErrorMessage('Failed to handle initialization errors'));
    });

    it('should handle database errors in label operations', async () => {
      await safeAsyncOperation(async () => {
        const server = await createServer();
        await server.getInitializationPromise();

        // Mock database error
        const mockDb = {
          findOne: vi.fn().mockRejectedValue(new Error('Database error')),
          findLabels: vi.fn().mockRejectedValue(new Error('Database error')),
        };

        Object.defineProperty(server, 'db', {
          value: mockDb,
          writable: true,
          configurable: true
        });

        // Test queryLabel
        await expect(server.queryLabels()).rejects.toThrow('Failed to query labels');

        // Test deleteLabel
        await expect(server.deleteLabel(new ObjectId())).rejects.toThrow('Failed to delete label');
      }, getErrorMessage('Failed to handle database errors in label operations'));
    });

    it('should handle errors in reverseLabelNegation', async () => {
      await safeAsyncOperation(async () => {
        const server = await createServer();
        await server.getInitializationPromise();

        // Test with non-existent label
        const result = await server.reverseLabelNegation(new ObjectId());
        expect(result).toBeNull();

        // Test with database error
        const mockDb = {
          findOne: vi.fn().mockRejectedValue(new Error('Database error')),
        };

        Object.defineProperty(server, 'db', {
          value: mockDb,
          writable: true,
          configurable: true
        });

        await expect(server.reverseLabelNegation(new ObjectId())).rejects.toThrow('Failed to reverse label negation');
      }, getErrorMessage('Failed to handle errors in reverseLabelNegation'));
    });

    it("should handle non-array response in queryLabels", async () => {
      await safeAsyncOperation(async () => {
        const server = await createServer();
        await server.getInitializationPromise();

        // Mock findLabels to return a non-array value
        vi.spyOn(server.db, "findLabels").mockResolvedValue({} as unknown as SavedLabel[]);

        await expect(server.queryLabels()).rejects.toThrow("Failed to query labels");
      }, getErrorMessage('Failed to handle non-array response in queryLabels'));
    });

    it("should handle signing failures in createLabel", async () => {
      await safeAsyncOperation(async () => {
        const server = await createServer();
        await server.getInitializationPromise();

        // Mock the signer to fail
        Object.defineProperty(server, "_signer", {
          value: {
            sign: vi.fn().mockRejectedValue(new Error("Signing failed")),
          },
          writable: true,
        });

        const validLabel: CreateLabelData = {
          ver: 1,
          val: "test",
          uri: "at://user.bsky.social/app.bsky.feed.post/3jxtb5w2g622y",
          cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
          neg: false,
        };

        await expect(server.createLabel(validLabel)).rejects.toThrow("Failed to create label");
      }, getErrorMessage('Failed to handle signing failures in createLabel'));
    });

    it("should handle errors when saving negated label in deleteLabel", async () => {
      await safeAsyncOperation(async () => {
        const server = await createServer();
        await server.getInitializationPromise();

        // Mock findOne to return a label and saveLabel to fail
        vi.spyOn(server.db, "findOne").mockResolvedValue({
          _id: new ObjectId(),
          ver: 1,
          val: "test",
          uri: "at://test.com",
          cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
          neg: false,
          cts: new Date().toISOString(),
          src: "did:web:test.com",
          sig: new ArrayBuffer(0),
        });

        vi.spyOn(server.db, "saveLabel").mockRejectedValue(new Error("Save failed"));

        await expect(server.deleteLabel(new ObjectId())).rejects.toThrow("Failed to save negated label to database");
      }, getErrorMessage('Failed to handle errors when saving negated label in deleteLabel'));
    });

    it("should handle errors when signing negated label in deleteLabel", async () => {
      await safeAsyncOperation(async () => {
        const server = await createServer();
        await server.getInitializationPromise();

        // Mock findOne to return a label and signer to fail
        vi.spyOn(server.db, "findOne").mockResolvedValue({
          _id: new ObjectId(),
          ver: 1,
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
            sign: vi.fn().mockRejectedValue(new Error("Signing failed")),
          },
          writable: true,
        });

        await expect(server.deleteLabel(new ObjectId())).rejects.toThrow("Failed to delete label");
      }, getErrorMessage('Failed to handle errors when signing negated label in deleteLabel'));
    });

    it("should return the correct label structure", async () => {
      await safeAsyncOperation(async () => {
        const label = await server.createLabel({
          ver: 1,
          val: "test",
          uri: "at://user.bsky.social/app.bsky.feed.post/3jxtb5w2g622y",
          cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        });

        expect(label).toBeDefined();
        expect(label.ver).toBe(1);
        expect(label.val).toBe("test");
        expect(label.uri).toBe("at://user.bsky.social/app.bsky.feed.post/3jxtb5w2g622y");
        expect(label.cid).toBe("bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi");
        expect(label.sig).toBeDefined();
      }, getErrorMessage('Failed to return the correct label structure'));
    });
  });
});
