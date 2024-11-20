// Mock the lexicons import
jest.mock('@atcute/ozone/lexicons');
jest.mock('../mongodb');

import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { LabelerServer } from '../LabelerServer.js';
import { MongoDBClient } from '../mongodb.js';
import { FastifyInstance } from 'fastify';

describe('LabelerServer', () => {
  let server: LabelerServer;
  let app: FastifyInstance;

  beforeEach(async () => {
    // Create a new server instance for each test
    server = new LabelerServer({
      did: 'did:example:test',
      signingKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      mongoUri: 'mongodb://mock',
      port: 4100
    });
    app = server.app;
    await app.ready(); // Wait for Fastify to be ready
  });

  afterEach(async () => {
    await server.close();
    jest.clearAllMocks();
  });

  describe('queryLabelsHandler', () => {
    it('should return empty labels array when no labels exist', async () => {
      await server.start();
      
      const response = await app.inject({
        method: 'GET',
        url: '/xrpc/com.atproto.label.queryLabels'
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({
        cursor: '0',
        labels: []
      });
    });

    it('should return labels when they exist', async () => {
      await server.start();
      
      // Create a test label
      const testLabel = await server.createLabel({
        src: 'did:example:test',
        uri: 'at://did:example:test/app.bsky.feed.post/test',
        val: 'test-label',
        neg: false
      });

      const response = await app.inject({
        method: 'GET',
        url: '/xrpc/com.atproto.label.queryLabels'
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.labels).toHaveLength(1);
      expect(result.labels[0]).toMatchObject({
        src: 'did:example:test',
        uri: 'at://did:example:test/app.bsky.feed.post/test',
        val: 'test-label',
        neg: false
      });
    });
  });

  describe('createLabel', () => {
    it('should create and save a label', async () => {
      const labelData = {
        src: 'did:example:test',
        uri: 'at://did:example:test/app.bsky.feed.post/test',
        val: 'test-label',
        neg: false,
      };

      const savedLabel = await server.createLabel(labelData);

      expect(savedLabel).toMatchObject({
        ...labelData,
        sig: expect.any(String),
        id: expect.any(Number),
      });
    });
  });

  describe('error handling', () => {
    it('should return 501 for unknown methods', async () => {
      await server.start();
      
      const response = await app.inject({
        method: 'GET',
        url: '/xrpc/unknown.method'
      });

      expect(response.statusCode).toBe(501);
      expect(response.payload).toBe('Method Not Implemented');
    });

    it('should return 500 for internal server errors', async () => {
      await server.start();
      
      // Mock the database to throw an error
      jest.spyOn(MongoDBClient.prototype, 'findLabels').mockRejectedValueOnce(new Error('Database error'));

      const response = await app.inject({
        method: 'GET',
        url: '/xrpc/com.atproto.label.queryLabels'
      });

      expect(response.statusCode).toBe(500);
      expect(response.payload).toBe('Internal Server Error');
    });
  });
});
