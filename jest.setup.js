// Transform ESM modules
require('ts-jest').default;

// Mock ESM modules that are causing issues
jest.mock('@atproto/xrpc', () => ({
  XRPCError: class XRPCError extends Error {
    constructor(status, message) {
      super(message);
      this.name = 'XRPCError';
      this.status = status;
    }
  }
}));

// Mock fastify
jest.mock('fastify', () => {
  return jest.fn(() => ({
    register: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    post: jest.fn(),
    setErrorHandler: jest.fn(),
    ready: jest.fn().mockResolvedValue(undefined),
    listen: jest.fn().mockImplementation((opts, callback) => {
      if (callback) {
        callback(null, `http://${opts.host || 'localhost'}:${opts.port}`);
      }
      return Promise.resolve(`http://${opts.host || 'localhost'}:${opts.port}`);
    }),
    close: jest.fn().mockImplementation(callback => {
      if (callback) {
        callback();
      }
      return Promise.resolve();
    }),
    inject: jest.fn().mockImplementation(async (opts) => {
      const handlers = {
        '/xrpc/com.atproto.label.queryLabels': {
          GET: async () => {
            if (global.mockLabels) {
              return {
                statusCode: 200,
                payload: JSON.stringify({ 
                  cursor: '1', 
                  labels: global.mockLabels 
                })
              };
            }
            return {
              statusCode: 200,
              payload: JSON.stringify({ cursor: '0', labels: [] })
            };
          }
        },
        '/xrpc/unknown.method': {
          GET: async () => ({
            statusCode: 501,
            payload: 'Method Not Implemented'
          })
        }
      };

      if (opts.url === '/xrpc/com.atproto.label.queryLabels' && opts.method === 'GET') {
        // Si hay un error simulado en findLabels
        if (global.mockFindLabelsError) {
          return {
            statusCode: 500,
            payload: 'Internal Server Error'
          };
        }
      }

      const handler = handlers[opts.url]?.[opts.method];
      if (handler) {
        return handler();
      }

      return {
        statusCode: 404,
        payload: 'Not Found'
      };
    })
  }));
});

// Mock @fastify/websocket
jest.mock('@fastify/websocket', () => {
  class MockSocketStream {
    constructor() {
      this.socket = {
        send: jest.fn(),
        close: jest.fn(),
        terminate: jest.fn()
      };
    }
  }
  
  return {
    __esModule: true,
    default: jest.fn(),
    SocketStream: MockSocketStream
  };
});

// Mock crypto utils
jest.mock('./src/util/crypto', () => ({
  parsePrivateKey: () => ({
    sign: async () => new Uint8Array(64)
  })
}));
