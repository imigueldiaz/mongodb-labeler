// @ts-nocheck
import { AtUri } from "@atproto/syntax";
import * as CIDModule from 'multiformats/cid'

const CID = CIDModule.CID;

/**
 * Custom error for AT Protocol validation failures
 */
export class AtProtocolValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AtProtocolValidationError";
  }
}

/**
 * Validates a DID according to AT Protocol specifications
 * @param did - The DID to validate
 * @throws {AtProtocolValidationError} If the DID is invalid
 */
export function validateDid(did: string): void {
  if (!did) {
    throw new AtProtocolValidationError("DID cannot be empty");
  }

  // DIDs in AT Protocol must start with 'did:'
  if (!did.startsWith("did:")) {
    throw new AtProtocolValidationError("DID must start with \"did:\"");
  }

  // Must have at least three parts: did:method:specific-id
  const parts = did.split(":");
  if (parts.length < 3) {
    throw new AtProtocolValidationError("DID must have at least three parts: did:method:specific-id");
  }

  // Validate the method (second part)
  const method = parts[1];
  if (!/^[a-z]+$/.test(method)) {
    throw new AtProtocolValidationError("DID method must contain only lowercase letters");
  }

  // Validate method length (should be reasonable)
  if (method.length < 2 || method.length > 32) {
    throw new AtProtocolValidationError("DID method must be between 2 and 32 characters");
  }

  // Validate the specific-id (third part)
  const specificId = parts.slice(2).join(":");
  if (!specificId) {
    throw new AtProtocolValidationError("DID specific-id cannot be empty");
  }

  // Check for invalid characters in specific-id
  if (/[\s<>{}[\]|\\^`]/.test(specificId)) {
    throw new AtProtocolValidationError("DID specific-id contains invalid characters");
  }

  // Check reasonable length for specific-id
  if (specificId.length > 512) {
    throw new AtProtocolValidationError("DID specific-id is too long (max 512 chars)");
  }
}

/**
 * Validates a URI according to AT Protocol specifications
 * @param uri - The URI to validate
 * @throws {AtProtocolValidationError} If the URI is invalid
 */
export function validateAtUri(uri: string): void {
  if (!uri) {
    throw new AtProtocolValidationError("URI cannot be null or empty");
  }

  // Basic AT Protocol URI validation
  if (!uri.startsWith("at://")) {
    throw new AtProtocolValidationError("Invalid AT Protocol URI: must start with \"at://\"");
  }

  try {
    // AtUri from @atproto/syntax will perform complete validation
    new AtUri(uri);
  } catch (error) {
    throw new AtProtocolValidationError(
      `Invalid AT Protocol URI: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

/**
 * Validates if a string is a valid CID (Content Identifier)
 * This validation checks the format for CIDv0 and CIDv1 (base32 and base58)
 * @param cidStr The CID string to validate
 * @throws {AtProtocolValidationError} If the CID is invalid
 */
export function validateCid(cidStr: string): void {
  if (!cidStr) {
    throw new AtProtocolValidationError("CID cannot be empty");
  }

  // Verificamos el prefijo básico
  if (!cidStr.startsWith('Q') && !cidStr.startsWith('b')) {
    throw new AtProtocolValidationError("CID must start with 'Q' (CIDv0) or 'b' (CIDv1)");
  }

  try {
    // Usamos el parser de CID para la validación real
    CID.parse(cidStr);
  } catch (error) {
    throw new AtProtocolValidationError("Invalid CID format");
  }
}
