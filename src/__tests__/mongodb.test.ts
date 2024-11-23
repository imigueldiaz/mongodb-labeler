import { MongoDBClient } from '../mongodb.js';
import type { UnsignedLabel } from '../util/types.js';

const TEST_TIMEOUT = 35000;

describe('MongoDBClient', () => {
  describe('MongoDB Operations', () => {
    it('should handle errors in updateLabel', async () => {
      const client = new MongoDBClient('mongodb://localhost:27017');
      const mockCollection = {
        updateOne: jest.fn().mockRejectedValue(new Error('Update failed'))
      };

      Object.defineProperty(client, '_labels', {
        value: mockCollection,
        writable: true
      });

      const testLabel: UnsignedLabel & { sig: ArrayBuffer } = {
        val: 'test',
        uri: 'test://uri',
        cid: 'test-cid',
        cts: new Date().toISOString(),
        src: 'did:web:test.com',
        neg: false,
        sig: new ArrayBuffer(0)
      };

      await expect(client.updateLabel(1, testLabel)).rejects.toThrow('Failed to update label');
    });

    it('should handle errors in getLabelsAfterCursor', async () => {
      const client = new MongoDBClient('mongodb://localhost:27017');
      const mockCollection = {
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              toArray: jest.fn().mockRejectedValue(new Error('Failed to get labels after cursor'))
            })
          })
        })
      };

      Object.defineProperty(client, '_labels', {
        value: mockCollection,
        writable: true
      });

      await expect(client.getLabelsAfterCursor(0, 10)).rejects.toThrow('Failed to get labels after cursor');
    });

    it('should handle uninitialized collection in operations', async () => {
      const client = new MongoDBClient('mongodb://localhost:27017');

      await expect(client.findLabels({})).resolves.toEqual([]);
      await expect(client.findOne({})).resolves.toBeNull();
      await expect(client.getLabelsAfterCursor(0, 10)).resolves.toEqual([]);
    });

    it('should handle first label creation with _getNextId', async () => {
      const client = new MongoDBClient('mongodb://localhost:27017');
      const mockCollection = {
        findOne: jest.fn().mockResolvedValue(null),
        insertOne: jest.fn().mockResolvedValue({ acknowledged: true })
      };

      Object.defineProperty(client, '_labels', {
        value: mockCollection,
        writable: true
      });

      const testLabel: UnsignedLabel & { sig: ArrayBuffer } = {
        val: 'test',
        uri: 'test://uri',
        cid: 'test-cid',
        cts: new Date().toISOString(),
        src: 'did:web:test.com',
        neg: false,
        sig: new ArrayBuffer(0)
      };

      await expect(client.saveLabel(testLabel)).resolves.toHaveProperty('id', 1);
    });

    it('should handle errors in listCollections during connect', async () => {
      const client = new MongoDBClient('mongodb://localhost:27017');
      const mockDb = {
        listCollections: jest.fn().mockReturnValue({
          toArray: jest.fn().mockRejectedValue(new Error('Failed to connect to MongoDB'))
        })
      };

      Object.defineProperty(client, '_db', {
        value: mockDb,
        writable: true
      });

      await expect(client.connect()).rejects.toThrow('Failed to connect to MongoDB');
    }, TEST_TIMEOUT);

    it('should handle errors in createIndex during connect', async () => {
      const client = new MongoDBClient('mongodb://localhost:27017');
      const mockCollection = {
        createIndex: jest.fn().mockRejectedValue(new Error('Failed to connect to MongoDB'))
      };
      const mockDb = {
        listCollections: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([])
        }),
        createCollection: jest.fn().mockResolvedValue(mockCollection),
        collection: jest.fn().mockReturnValue(mockCollection)
      };

      Object.defineProperty(client, '_db', {
        value: mockDb,
        writable: true
      });

      await expect(client.connect()).rejects.toThrow('Failed to connect to MongoDB');
    }, TEST_TIMEOUT);
  });
});
