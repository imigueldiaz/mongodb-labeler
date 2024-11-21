
// Mock ESM modules that are causing issues
jest.mock('@atproto/xrpc', () => ({
  XRPCError: class XRPCError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = 'XRPCError';
      this.status = status;
    }
  }
}));

// Initialize global mocks
(global as any).mockFindLabelsError = false;
(global as any).mockLabels = undefined;

// Mock fastify
jest.mock('fastify', () => {
  return jest.fn(() => ({
    register: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    post: jest.fn(),
    setErrorHandler: jest.fn(),
    ready: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    inject: jest.fn().mockImplementation((opts: { url: string; method: string }) => {
      const routes = {
        '/xrpc/com.atproto.label.queryLabels': {
          GET: () => {
            if ((global as any).mockFindLabelsError) {
              return {
                statusCode: 500,
                payload: 'Internal Server Error'
              };
            }
            return {
              statusCode: 200,
              payload: JSON.stringify({
                cursor: '0',
                labels: (global as any).mockLabels || []
              })
            };
          }
        },
        '/xrpc/unknown.method': {
          GET: () => ({
            statusCode: 501,
            payload: 'Method Not Implemented'
          })
        }
      };

      const route = routes[opts.url as keyof typeof routes];
      if (route && route[opts.method as keyof typeof route]) {
        return Promise.resolve(route[opts.method as keyof typeof route]());
      }

      return Promise.resolve({
        statusCode: 404,
        payload: 'Not Found'
      });
    }),
    app: {}
  }));
});

class MockSocketStream {
  socket: {
    send: jest.Mock;
    close: jest.Mock;
    terminate: jest.Mock;
  };

  constructor() {
    this.socket = {
      send: jest.fn(),
      close: jest.fn(),
      terminate: jest.fn()
    };
  }
}

export default {
  __esModule: true,
  default: jest.fn(),
  SocketStream: MockSocketStream
};
