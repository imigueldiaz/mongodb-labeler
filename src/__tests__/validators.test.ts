// Mock @atproto/syntax before imports
jest.mock("@atproto/syntax", () => ({
  AtUri: jest.fn().mockImplementation((uri: string) => {
    if (uri === "at://mock/error") {
      throw new Error("Mock AtUri error");
    }
    return {};
  }),
}));

import { validateAtUri, validateCid, validateDid, validateVal, validateCts, validateExp } from "../util/validators";
import { AtProtocolValidationError } from "../util/validators";

describe("DID Validation", () => {
  // Test valid DIDs
  it("should accept valid DIDs", () => {
    const validDids = [
      "did:plc:user123",
      "did:web:example.com",
      "did:key:z6Mkf5rGMQm3xqMzLAMQm3xqMzLAM",
      "did:method:specific:with:many:colons",
      "did:test:abc123.456-789",
    ];

    validDids.forEach(did => {
      expect(() => validateDid(did)).not.toThrow();
    });
  });

  // Test empty DID
  it("should throw error for empty DID", () => {
    expect(() => validateDid("")).toThrow(AtProtocolValidationError);
    expect(() => validateDid("")).toThrow("DID cannot be empty");
  });

  // Test DID prefix
  it("should throw error for DIDs not starting with 'did:'", () => {
    const invalidPrefixes = [
      "plc:user123",
      "did-plc:user123",
      "Did:plc:user123",
      ":plc:user123",
    ];

    invalidPrefixes.forEach(did => {
      expect(() => validateDid(did)).toThrow(AtProtocolValidationError);
      expect(() => validateDid(did)).toThrow("DID must start with \"did:\"");
    });
  });

  // Test DID parts
  it("should throw error for DIDs with insufficient parts", () => {
    const insufficientParts = [
      "did:",
      "did:plc",
      "did:",
    ];

    insufficientParts.forEach(did => {
      expect(() => validateDid(did)).toThrow(AtProtocolValidationError);
      expect(() => validateDid(did)).toThrow("DID must have at least three parts");
    });
  });

  // Test method validation
  it("should throw error for DIDs with invalid method", () => {
    const invalidMethods = [
      "did:PLC:user123",
      "did:123:user123",
      "did:plc-method:user123",
      "did:a:user123", // too short
      "did:methodthatiswaytoolongforvalidation:user123", // too long
    ];

    invalidMethods.forEach(did => {
      expect(() => validateDid(did)).toThrow(AtProtocolValidationError);
    });
  });

  // Test specific-id validation
  it("should throw error for DIDs with invalid specific-id", () => {
    const invalidSpecificIds = [
      "did:plc:",
      "did:plc:user 123",
      "did:plc:user<123>",
      "did:plc:user{123}",
      "did:plc:user[123]",
      "did:plc:user\\123",
      "did:plc:user|123",
      "did:plc:user^123",
      "did:plc:user`123",
      "did:plc:" + "x".repeat(513), // too long
    ];

    invalidSpecificIds.forEach(did => {
      expect(() => validateDid(did)).toThrow(AtProtocolValidationError);
    });
  });
});

describe("CID Validation", () => {
  // Ejemplos reales de CIDs
  it("should accept valid CIDs", () => {
    const validCids = [
      // CIDv0 - Un hash real de IPFS
      "QmPK1s3pNYLi9ERiq3BDxKa4XosgWwFRQUydHUtz4YgpqB",
      // CIDv1 - Otro hash real de IPFS
      "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
    ];

    validCids.forEach(cid => {
      expect(() => validateCid(cid)).not.toThrow();
    });
  });

  it("should reject invalid CIDs", () => {
    const invalidCids = [
      "", // vacío
      "NotACid", // formato completamente inválido
      "Qm123", // CIDv0 inválido
      "bafybei", // CIDv1 demasiado corto
      "kafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi" // prefijo incorrecto
    ];

    invalidCids.forEach(cid => {
      expect(() => validateCid(cid)).toThrow(AtProtocolValidationError);
    });
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

describe("Label Value Validation", () => {
  // Test valid label values
  it("should accept valid label values", () => {
    const validValues = [
      "spam",
      "adult",
      "!warn",
      "!takedown",
      "scam",
      "dmca",
      "abuse",
      "reasonablelengthvalue123",
    ];

    validValues.forEach(val => {
      expect(() => validateVal(val)).not.toThrow();
    });
  });

  // Test empty value
  it("should throw error for empty value", () => {
    expect(() => validateVal("")).toThrow(AtProtocolValidationError);
    expect(() => validateVal("")).toThrow("Label value cannot be empty");
  });

  // Test byte length
  it("should throw error for values exceeding 128 bytes", () => {
    const longValue = "x".repeat(129);
    expect(() => validateVal(longValue)).toThrow(AtProtocolValidationError);
    expect(() => validateVal(longValue)).toThrow("Label value cannot exceed 128 bytes");
  });

  // Test whitespace
  it("should throw error for values containing whitespace", () => {
    const valuesWithSpace = [
      "label with space",
      "label\twith\ttab",
      "label\nwith\nnewline",
      " leadingspace",
      "trailingspace ",
    ];

    valuesWithSpace.forEach(val => {
      expect(() => validateVal(val)).toThrow(AtProtocolValidationError);
      expect(() => validateVal(val)).toThrow("Label value cannot contain whitespace");
    });
  });

  // Test non-ASCII characters
  it("should throw error for values with non-ASCII characters", () => {
    const nonAsciiValues = [
      "label💡",
      "étiquette",
      "标签",
      "ラベル",
    ];

    nonAsciiValues.forEach(val => {
      expect(() => validateVal(val)).toThrow(AtProtocolValidationError);
      expect(() => validateVal(val)).toThrow("Label value must only contain ASCII characters");
    });
  });

  // Test punctuation
  it("should throw error for invalid punctuation", () => {
    const invalidPunctuation = [
      "label.with.dots",
      "label,with,commas",
      "label:with:colons",
      "label;with;semicolons",
      "label#with#hash",
      "label_with_underscore",
      "label'with'quotes",
      "label>with>gt",
      "label<with<lt",
      "label\\with\\backslash",
      "label|with|pipe",
      "label^with^caret",
      "!label.with.dots",
      "!label,with,commas",
    ];

    invalidPunctuation.forEach(val => {
      expect(() => validateVal(val)).toThrow(AtProtocolValidationError);
      expect(() => validateVal(val)).toThrow("Label value contains invalid punctuation characters");
    });
  });

  // Test system labels
  it("should handle system labels correctly", () => {
    // Valid system labels
    const validSystemLabels = [
      "!warn",
      "!takedown",
      "!suspend",
    ];

    validSystemLabels.forEach(val => {
      expect(() => validateVal(val)).not.toThrow();
    });

    // Invalid system labels (! not at start)
    const invalidSystemLabels = [
      "warn!",
      "take!down",
      "sus!pend",
    ];

    invalidSystemLabels.forEach(val => {
      expect(() => validateVal(val)).toThrow(AtProtocolValidationError);
      expect(() => validateVal(val)).toThrow("Label value contains invalid punctuation characters");
    });
  });
});

describe("Timestamp Validation", () => {
  let originalDate: DateConstructor;
  const mockNow = new Date("2023-12-25T12:00:00Z");

  beforeAll(() => {
    // Store the original Date constructor
    originalDate = global.Date;
    
    // Mock Date to return a fixed date
    class MockDate extends Date {
      constructor(value?: string | number | Date);
      constructor(year: number, month: number, date?: number, hours?: number, minutes?: number, seconds?: number, ms?: number);
      constructor(first?: string | number | Date | undefined, month?: number, date?: number, hours?: number, minutes?: number, seconds?: number, ms?: number) {
        if (arguments.length === 0) {
          super(mockNow);
        } else if (arguments.length === 1) {
          super(first as string | number | Date);
        } else {
          // Handle multi-parameter constructor
          const year = first as number;
          super(
            year,
            month || 0,
            date || 1,
            hours || 0,
            minutes || 0,
            seconds || 0,
            ms || 0
          );
        }
      }
    }
    
    global.Date = MockDate as DateConstructor;
  });

  afterAll(() => {
    // Restore the original Date constructor
    global.Date = originalDate;
  });

  describe("Creation Timestamp (cts)", () => {
    it("should accept valid creation timestamps", () => {
      const validTimestamps = [
        "2023-12-25T11:59:59Z", // Just before now
        "2023-12-25T11:59:59.999Z", // With milliseconds
        "2023-12-25T12:00:00+00:00", // Alternative timezone format
        "2023-12-25T13:00:00+01:00", // Different timezone
        "2023-12-25T07:00:00-05:00", // Different timezone
      ];

      validTimestamps.forEach(timestamp => {
        expect(() => validateCts(timestamp)).not.toThrow();
      });
    });

    it("should reject invalid creation timestamps", () => {
      const invalidTimestamps = [
        "", // Empty string
        "not-a-date", // Invalid format
        "2023-13-25T12:00:00Z", // Invalid month
        "2023-12-32T12:00:00Z", // Invalid day
        "2023-12-25T24:00:00Z", // Invalid hour
        "2023-12-25T12:60:00Z", // Invalid minute
        "2023-12-25T12:00:60Z", // Invalid second
        "2023-12-25 12:00:00", // Missing T and timezone
        "2023-12-25", // Missing time part
        "12:00:00Z", // Missing date part
      ];

      invalidTimestamps.forEach(timestamp => {
        expect(() => validateCts(timestamp)).toThrow(AtProtocolValidationError);
      });
    });

    it("should reject future creation timestamps", () => {
      const futureTimestamps = [
        "2023-12-25T12:00:01Z", // 1 second in future
        "2023-12-25T13:00:00Z", // 1 hour in future
        "2023-12-26T12:00:00Z", // 1 day in future
        "2024-12-25T12:00:00Z", // 1 year in future
      ];

      futureTimestamps.forEach(timestamp => {
        expect(() => validateCts(timestamp)).toThrow(AtProtocolValidationError);
        expect(() => validateCts(timestamp)).toThrow("Creation timestamp cannot be in the future");
      });
    });
  });

  describe("Expiration Timestamp (exp)", () => {
    it("should accept valid expiration timestamps", () => {
      const validTimestamps = [
        "2024-12-25T12:00:00Z", // Future date
        "2024-12-25T12:00:00.000Z", // With milliseconds
        "2024-12-25T12:00:00+00:00", // Alternative timezone format
        "2024-12-25T13:00:00+01:00", // Different timezone
        "2024-12-25T07:00:00-05:00", // Different timezone
      ];

      validTimestamps.forEach(timestamp => {
        expect(() => validateExp(timestamp)).not.toThrow();
      });
    });

    it("should reject invalid expiration timestamps", () => {
      const invalidTimestamps = [
        "", // Empty string
        "not-a-date", // Invalid format
        "2023-13-25T12:00:00Z", // Invalid month
        "2023-12-32T12:00:00Z", // Invalid day
        "2023-12-25T24:00:00Z", // Invalid hour
        "2023-12-25T12:60:00Z", // Invalid minute
        "2023-12-25T12:00:60Z", // Invalid second
        "2023-12-25 12:00:00", // Missing T and timezone
        "2023-12-25", // Missing time part
        "12:00:00Z", // Missing date part
      ];

      invalidTimestamps.forEach(timestamp => {
        expect(() => validateExp(timestamp)).toThrow();
      });
    });

    it("should reject past or present expiration timestamps", () => {
      const pastTimestamps = [
        "2023-12-25T11:59:59Z", // Past
        "2023-12-25T12:00:00Z", // Present
      ];

      pastTimestamps.forEach(timestamp => {
        expect(() => validateExp(timestamp)).toThrow('Expiration timestamp must be in the future');
      });

      // Should accept past timestamps when allowExpired is true
      pastTimestamps.forEach(timestamp => {
        expect(() => validateExp(timestamp, true)).not.toThrow();
      });
    });
  });
});
