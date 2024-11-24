import { LabelerServer, LabelerServerError } from '../LabelerServer';
import type { LabelerOptions } from '../LabelerServer.js';
import { MongoClient, type Collection } from "mongodb";
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { SavedLabel, UnsignedLabel } from '../util/types.js';

const TEST_TIMEOUT = 35000;
const SETUP_TIMEOUT = 120000; // 2 minutos para la descarga del servidor

describe('LabelerServer', () => {
  let mongoServer: MongoMemoryServer;
  let connection: MongoClient;
  let collection: Collection<SavedLabel>;
  let server: LabelerServer;
  const options: LabelerOptions = {
    did: 'did:web:test.com',
    signingKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    mongoUri: '',
    databaseName: 'test', 
    collectionName: 'labels' 
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    options.mongoUri = mongoServer.getUri();
    connection = await MongoClient.connect(options.mongoUri);
    collection = connection.db('test').collection('labels');
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
      collection = connection.db('test').collection('labels');
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

  describe('MongoDB Operations', () => {
    // Increase timeout for MongoDB operations
    jest.setTimeout(120000); // 2 minutes

    it('should handle invalid MongoDB URI', () => {
      expect(() => new LabelerServer({
        ...options,
        mongoUri: 'invalid-uri'
      })).toThrow('Invalid server configuration: Invalid scheme, expected connection string to start with "mongodb://" or "mongodb+srv://"');
    }, TEST_TIMEOUT);

    it('should handle connection failures', async () => {
      const failingServer = new LabelerServer({
        ...options,
        mongoUri: 'mongodb://invalid-host:27017'
      });

      await expect(failingServer.db.connect()).rejects.toThrow('Failed to connect to MongoDB');
    }, TEST_TIMEOUT);

    it('should handle connection string validation', () => {
      expect(() => new LabelerServer({
        ...options,
        mongoUri: ''
      })).toThrow('Invalid server configuration: Missing required parameter: mongoUri');
    });

    it('should handle errors in close', async () => {
      const error = new Error('Close failed');
      const closeSpy = jest.spyOn(server.db, 'close').mockRejectedValueOnce(error);

      try {
        await server.close();
        fail('Expected server.close() to throw an error');
      } catch (err: unknown) {
        if (err instanceof LabelerServerError) {
          expect(err.message).toBe('Failed to close database connection');
        } else {
          fail('Expected error to be instance of LabelerServerError');
        }
      } finally {
        closeSpy.mockRestore();
      }
    });
  });

  describe('Label Operations', () => {
    it('should create label with expiration', async () => {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + 1); // Set expiration to tomorrow
      
      const testLabel: Omit<UnsignedLabel, 'cts'> = {
        val: 'test',
        uri: 'at://did:web:test.com/app.bsky.feed.post/test',
        cid: 'bafyreie5cvv4h45feadlkyw2b2jmkrxhiwdwvqokkf7k3tvtc3xqbrnx7y',
        neg: false,
        src: 'did:web:test.com',
        exp: expDate.toISOString()
      };
      
      const labelWithExp = await server.createLabel(testLabel);
      expect(labelWithExp.exp).toBe(expDate.toISOString());
    }, TEST_TIMEOUT);

    it('should handle invalid label data', async () => {
      const invalidLabel: Omit<UnsignedLabel, 'cts'> = {
        val: '',
        uri: 'invalid-uri',
        cid: 'invalid-cid',
        neg: false,
        src: 'did:web:test.com'
      };

      await expect(server.createLabel(invalidLabel)).rejects.toThrow();
    }, TEST_TIMEOUT);

    describe('Label Negation', () => {
      const mockLabel: SavedLabel = {
        id: 1,
        val: 'test-label',
        uri: 'at://test.com',
        cid: 'bafyreidfayvfuwqa7qlnopkwu64bkizzbj3pdw5kaewd7a6d66t7iulpce',
        neg: false,
        src: 'did:web:test.com',
        cts: new Date().toISOString(),
        sig: new ArrayBuffer(64)
      };

      it('should reverse label negation', async () => {
        jest.spyOn(server.db, 'findLabels').mockResolvedValue([mockLabel]);
        jest.spyOn(server.db, 'updateLabel').mockResolvedValue(true);

        const result = await server.reverseLabelNegation(1, true);
        expect(result).not.toBeNull();
        expect(result?.neg).toBe(true);
      });

      it('should handle non-existent label in reverseLabelNegation', async () => {
        jest.spyOn(server.db, 'findLabels').mockResolvedValue([]);

        const result = await server.reverseLabelNegation(999);
        expect(result).toBeNull();
      });

      it('should handle database error in reverseLabelNegation', async () => {
        jest.spyOn(server.db, 'findLabels').mockRejectedValue(new Error('Failed to reverse label negation'));

        await expect(server.reverseLabelNegation(1)).rejects.toThrow('Failed to reverse label negation');
      });
    });
  });
});