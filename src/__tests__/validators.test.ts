// Mock @atproto/syntax before imports
jest.mock("@atproto/syntax", () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  AtUri: jest.fn().mockImplementation((uri: string) => {
    if (uri === "at://mock/error") {
      throw new Error("Mock AtUri error");
    }
    return {};
  }),
}));

import { validateAtUri, validateCid, validateDid } from "../util/validators";
import { AtProtocolValidationError } from "../util/validators"; // Assuming this is where the error is defined

describe("validateDid", () => {
  // Test valid DIDs
  it("should accept valid DIDs", () => {
    expect(() => {
      validateDid("did:plc:user123");
    }).not.toThrow();
    expect(() => {
      validateDid("did:web:example.com");
    }).not.toThrow();
    expect(() => {
      validateDid("did:key:z6Mkf5rGgQm3xqMzLAMQm3xqMzLAMQm3xqMzLAMQm3xqMzLAM");
    }).not.toThrow();
  });

  // Test invalid DIDs
  it("should throw error for DIDs not starting with \"did:\"", () => {
    expect(() => {
      validateDid("plc:user123");
    }).toThrow(AtProtocolValidationError);
    expect(() => {
      validateDid("did-plc:user123");
    }).toThrow(AtProtocolValidationError);
  });

  // Test DIDs with insufficient parts
  it("should throw error for DIDs with insufficient parts", () => {
    expect(() => {
      validateDid("did:");
    }).toThrow(AtProtocolValidationError);
    expect(() => {
      validateDid("did:plc");
    }).toThrow(AtProtocolValidationError);
  });

  // Test invalid method
  it("should throw error for DIDs with invalid method", () => {
    expect(() => {
      validateDid("did:PLC:user123");
    }).toThrow(AtProtocolValidationError);
    expect(() => {
      validateDid("did:plc123:user123");
    }).toThrow(AtProtocolValidationError);
    expect(() => {
      validateDid("did:plc-method:user123");
    }).toThrow(AtProtocolValidationError);
  });

  // Test invalid specific-id
  it("should throw error for DIDs with invalid specific-id", () => {
    expect(() => {
      validateDid("did:plc:");
    }).toThrow(AtProtocolValidationError);
    expect(() => {
      validateDid("did:plc:user 123");
    }).toThrow(AtProtocolValidationError);
  });
});

describe("validateAtUri", () => {
  // Test invalid AT Protocol URIs
  it("should throw AtProtocolValidationError for URIs with invalid protocol", () => {
    const invalidProtocols = [
      "http://example.com", // wrong protocol
      "atp://invalid", // wrong protocol
      "at:invalid", // missing double slash
    ];

    invalidProtocols.forEach(uri => {
      expect(() => {
        validateAtUri(uri);
      }).toThrow(AtProtocolValidationError);
      expect(() => {
        validateAtUri(uri);
      }).toThrow("must start with \"at://\"");
    });
  });

  it("should throw AtProtocolValidationError when AtUri constructor fails", () => {
    // Use our mocked URI that we know will cause AtUri to throw
    expect(() => {
      validateAtUri("at://mock/error");
    }).toThrow(AtProtocolValidationError);
    expect(() => {
      validateAtUri("at://mock/error");
    }).toThrow("Invalid AT Protocol URI");
  });

  // Test edge cases
  it("should handle edge cases", () => {
    // Empty string
    expect(() => {
      validateAtUri("");
    }).toThrow(AtProtocolValidationError);
    expect(() => {
      validateAtUri("");
    }).toThrow("URI cannot be null or empty");

    // Null and undefined
    expect(() => {
      validateAtUri(null as unknown as string);
    }).toThrow(AtProtocolValidationError);
    expect(() => {
      validateAtUri(null as unknown as string);
    }).toThrow("URI cannot be null or empty");
    expect(() => {
      validateAtUri(undefined as unknown as string);
    }).toThrow(AtProtocolValidationError);
    expect(() => {
      validateAtUri(undefined as unknown as string);
    }).toThrow("URI cannot be null or empty");
  });
});

describe("validateCid", () => {
  // Test valid CIDs
  it("should accept valid base32 and base58 CIDs", () => {
    const validCids = [
      "bafybeigdyrzt5sfp7udm7hu76kqbmtxwmgaslqbm25j6lwsxzd53kbcpea", // base32 example
      "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco", // base58 example
      "QmcRD4wkPv6xmfBKsKzrrYsyyHBjzaMA8LaRRRRbNDQVH3", // another base58 example
    ];

    validCids.forEach(cid => {
      expect(() => {
        validateCid(cid);
      }).not.toThrow();
    });
  });

  // Test invalid CIDs
  it("should throw error for CIDs with invalid characters", () => {
    const invalidCids = [
      "cid_with_underscore",
      "cid-with-hyphen",
      "cid with spaces",
      "!@#$%^&*()", // special characters
    ];

    invalidCids.forEach(cid => {
      expect(() => {
        validateCid(cid);
      }).toThrow(AtProtocolValidationError);
      expect(() => {
        validateCid(cid);
      }).toThrow("Invalid CID format");
    });
  });

  // Test CID length validation
  it("should throw error for CIDs that are too short", () => {
    const shortCids = [
      "a",
      "123",
      "bafybeig",
      "QmXo", // too short CIDs
    ];

    shortCids.forEach(cid => {
      expect(() => {
        validateCid(cid);
      }).toThrow(AtProtocolValidationError);
      expect(() => {
        validateCid(cid);
      }).toThrow("CID length is too short");
    });
  });

  // Edge case: empty string
  it("should throw error for empty string", () => {
    expect(() => {
      validateCid("");
    }).toThrow(AtProtocolValidationError);
    expect(() => {
      validateCid("");
    }).toThrow("Invalid CID format");
  });
});
