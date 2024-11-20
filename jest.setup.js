// Transform ESM modules
require('ts-jest').default;

// Mock ESM modules that are causing issues
jest.mock('@atcute/client', () => ({
  XRPCError: class XRPCError extends Error {
    constructor(message) {
      super(message);
      this.name = 'XRPCError';
    }
  }
}));

jest.mock('@atcute/client/utils/did', () => ({
  DidDocument: class DidDocument {}
}));

jest.mock('@noble/curves/p256', () => ({
  p256: {
    getPublicKey: () => new Uint8Array(32),
    verify: () => true,
    sign: () => new Uint8Array(64)
  }
}));

jest.mock('@noble/curves/secp256k1', () => ({
  secp256k1: {
    getPublicKey: () => new Uint8Array(32),
    verify: () => true,
    sign: () => new Uint8Array(64)
  }
}));

jest.mock('uint8arrays', () => ({
  toString: (arr) => Buffer.from(arr).toString('base64'),
  fromString: (str) => Buffer.from(str, 'base64'),
  concat: (arrays) => Buffer.concat(arrays)
}));

jest.mock('@atcute/cbor', () => ({
  encode: () => new Uint8Array([]),
  decode: () => ({}),
  BytesWrapper: class BytesWrapper {
    constructor(bytes) {
      this.bytes = bytes;
    }
  },
  fromBytes: (bytes) => new Uint8Array(bytes),
  toBytes: (data) => new Uint8Array([])
}));

// Mock crypto utils
jest.mock('./src/util/crypto', () => ({
  parsePrivateKey: () => ({
    sign: async () => new Uint8Array(64)
  })
}));
