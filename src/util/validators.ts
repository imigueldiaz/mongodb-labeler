import { AtUri } from "@atproto/syntax";

/**
 * Custom error for AT Protocol validation failures
 */
export class AtProtocolValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AtProtocolValidationError';
    }
}

/**
 * Validates a DID according to AT Protocol specifications
 * @param did - The DID to validate
 * @throws {AtProtocolValidationError} If the DID is invalid
 */
export function validateDid(did: string): void {
    // DIDs in AT Protocol must start with 'did:'
    if (!did.startsWith('did:')) {
        throw new AtProtocolValidationError('DID must start with "did:"');
    }

    // Must have at least three parts: did:method:specific-id
    const parts = did.split(':');
    if (parts.length < 3) {
        throw new AtProtocolValidationError('DID must have at least three parts: did:method:specific-id');
    }

    // Validate the method (second part)
    const method = parts[1];
    if (!/^[a-z]+$/.test(method)) {
        throw new AtProtocolValidationError('DID method must contain only lowercase letters');
    }

    // Validate the specific-id (third part)
    const specificId = parts.slice(2).join(':');
    if (!specificId || /\s/.test(specificId)) {
        throw new AtProtocolValidationError('DID specific-id cannot be empty or contain whitespace');
    }
}

/**
 * Validates a URI according to AT Protocol specifications
 * @param uri - The URI to validate
 * @throws {AtProtocolValidationError} If the URI is invalid
 */
export function validateAtUri(uri: string): void {
    if (!uri) {
        throw new AtProtocolValidationError('URI cannot be null or empty');
    }

    // Basic AT Protocol URI validation
    if (!uri.startsWith('at://')) {
        throw new AtProtocolValidationError('Invalid AT Protocol URI: must start with "at://"');
    }

    try {
        // AtUri from @atproto/syntax will perform complete validation
        new AtUri(uri);
    } catch (error) {
        throw new AtProtocolValidationError(`Invalid AT Protocol URI: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
}

/**
 * Validates a CID according to IPFS/AT Protocol specifications
 * @param cid - The CID to validate
 * @throws {AtProtocolValidationError} If the CID is invalid
 */
export function validateCid(cid: string): void {
    // CIDs in AT Protocol are base32 or base58 strings
    const cidRegex = /^[a-zA-Z0-9]+$/;
    if (!cidRegex.test(cid)) {
        throw new AtProtocolValidationError('Invalid CID format');
    }

    // CIDs have a minimum length
    if (cid.length < 46) { // CIDv1 typically has at least 46 characters
        throw new AtProtocolValidationError('CID length is too short');
    }
}
