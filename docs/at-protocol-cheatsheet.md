# AT Protocol Technical Cheatsheet

## Quick Reference

### Core Components

- **DIDs (Decentralized Identifiers)**: Persistent account identifiers
- **CIDs (Content Identifiers)**: Content-addressed identifiers for data
- **Labels**: Metadata tags for accounts and content

## DIDs - Decentralized Identifiers

### Supported DID Methods

- `did:web`: Based on HTTPS/DNS, hostname-level only
- `did:plc`: Bluesky's custom DID method

### DID Syntax Rules

- Starts with `did:`
- Case-sensitive
- Uses ASCII subset: `A-Z`, `a-z`, `0-9`, `._:%-`
- Method segment: lowercase letters followed by `:`
- 2KB maximum length
- No query (`?`) or fragment (`#`) parts allowed

### DID Document Components

- **Handle**: Found in `alsoKnownAs` array with `at://` scheme
- **Signing Key**: In `verificationMethod` array, ID ends with `#atproto`
- **PDS Location**: In `service` array, ID ends with `#atproto_pds`

## Labels

### Label Structure

```json
{
  "ver": 1,                // Version (required)
  "src": "did:example:123", // Source DID (required)
  "uri": "at://...",      // Subject URI (required)
  "cid": "bafy...",       // Optional specific version
  "val": "label-value",   // Label value (required, max 128 bytes)
  "neg": false,           // Negation flag (optional)
  "cts": "timestamp",     // Creation timestamp (required)
  "exp": "timestamp"      // Expiration (optional)
}
```

### Label Value Guidelines

- Use lowercase kebab-case (e.g., `label-name`)
- ASCII letters only (a-z)
- No punctuation except internal hyphens
- Maximum 128 bytes length
- Prefix with `!` for system-level labels

### Label Distribution

- Subscribe via WebSocket: `com.atproto.label.subscribeLabels`
- Query endpoint: `com.atproto.label.queryLabels`
- Headers:
  - Request: `atproto-accept-labelers`
  - Response: `atproto-content-labelers`

## CIDs (Content Identifiers)

### CIDv1 Structure

```text
<cidv1> ::= <multibase-prefix><version><content-type><multihash>
```

### Components

- **Multibase**: Encoding prefix for string representation
- **Version**: CID format version (0x01 for CIDv1)
- **Content-type**: Multicodec identifying content format
- **Multihash**: Content hash with hash function identifier

### Formats

- Binary format for compact storage
- Stringified format with multibase prefix for transport
- Human-readable format for debugging

### CIDv0 vs CIDv1

- CIDv0: Legacy format, always base58btc + dag-pb + sha256
- CIDv1: Flexible format with explicit version and content type

## Best Practices

1. **DIDs**
   - Keep DIDs short (<64 chars if possible)
   - Validate handle bidirectionally
   - Always verify PDS service endpoints

2. **Labels**
   - Use descriptive but concise label values
   - Follow kebab-case convention
   - Implement proper signature validation

3. **CIDs**
   - Use CIDv1 for new implementations
   - Choose appropriate multibase for transport context
   - Validate format before decoding

## Common Pitfalls

- Not validating DID syntax and components
- Using unsupported label characters or formats
- Incorrect handling of CID versions and encodings
- Missing signature verification for labels
- Not checking handle <-> DID bidirectional resolution

## Additional Resources

- [AT Protocol Specs](https://atproto.com/specs)
- [did:plc Method Spec](https://github.com/did-method-plc/did-method-plc)
- [Multicodec Table](https://github.com/multiformats/multicodec/blob/master/table.csv)
