import { Secp256k1Keypair } from "@atproto/crypto";
import { MongoDBClient } from "./mongodb.js";
import { CreateLabelData, SavedLabel, SignedLabel, UnsignedLabel } from "./util/types.js";
import { AtProtocolValidationError, validateCid, validateDid, validateVal, validateCts, validateExp, validateUri } from "./util/validators.js";

/**
 * Error class for LabelerServer operations
 */
export class LabelerServerError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = "LabelerServerError";
  }
}

/**
 * Options for initializing a LabelerServer instance.
 *
 * @param did - The DID of the labeler.
 * @param signingKey - The signing key of the labeler, as a base64-encoded string.
 * @param mongoUri - The URI to connect to the MongoDB instance.
 * @param databaseName - The name of the MongoDB database to use. Defaults to 'labeler'.
 * @param collectionName - The name of the MongoDB collection to use. Defaults to 'labels'.
 * @param port - The port to listen on. Defaults to 4100.
 */
export interface LabelerOptions {
  did: `did:${string}`;
  signingKey: string;
  mongoUri: string;
  databaseName?: string;
  collectionName?: string;
  port?: number;
}

/**
 * LabelerServer is responsible for managing label creation, querying, and deletion
 * operations. It interfaces with a MongoDB database to persist label data and uses
 * cryptographic signing to ensure label authenticity.
 *
 * This class requires initialization with LabelerOptions, which include database
 * connection details and a signing key. The server supports operations such as
 * creating new labels, querying existing ones by ID, and marking labels as deleted
 * by signing them with a negation flag.
 *
 * The labels are signed using a Secp256k1Keypair, and the signatures are stored
 * in the database alongside the label data.
 */
export class LabelerServer {
  private readonly _db: MongoDBClient;
  public get db(): MongoDBClient {
    return this._db;
  }

  private _signer!: Secp256k1Keypair;
  private set _setSigner(value: Secp256k1Keypair) {
    this._signer = value;
  }

  private readonly _did: `did:${string}`;
  public get did(): `did:${string}` {
    return this._did;
  }

  private _nextId: number;

  private _initializeSigner: Promise<void>;
  private _initializationError?: Error;

  /**
   * Returns the promise that resolves when the signer is initialized.
   * @returns A promise that resolves when initialization is complete.
   * @throws {Error} If initialization failed
   */
  getInitializationPromise(): Promise<void> {
    if (this._initializationError) {
      throw this._initializationError;
    }
    return this._initializeSigner;
  }

  /**
   * Creates a new instance of the LabelerServer.
   * @param options The options for the server
   * @throws {LabelerServerError} If initialization fails
   */
  constructor(options: LabelerOptions) {
    try {
      // Validate required parameters
      if (!options.signingKey) {
        throw new LabelerServerError("Invalid server configuration: Missing required parameter: signingKey");
      }
      if (!options.mongoUri) {
        throw new LabelerServerError("Invalid server configuration: Missing required parameter: mongoUri");
      }

      // Validate the server's DID from the start
      validateDid(options.did);

      // Initialize MongoDB client
      this._db = new MongoDBClient(options.mongoUri);

      this._did = options.did;
      this._nextId = 1;

      // Initialize the signer
      this._initializeSigner = Secp256k1Keypair.import(options.signingKey).then(keypair => {
        this._signer = keypair;
      }).catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this._initializationError = new Error(`Failed to initialize signer: ${errorMessage}`);
        throw this._initializationError;
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new LabelerServerError(`Invalid server configuration: ${error.message}`, error);
      }
      throw new LabelerServerError(`Invalid server configuration: ${String(error)}`);
    }
  }

  /**
   * Close the connection to the MongoDB instance.
   *
   * This method should be called when the LabelerServer is no longer needed.
   * @throws {LabelerServerError} If closing the connection fails
   */
  async close(): Promise<void> {
    try {
      await this.db.close();
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new LabelerServerError(
          "Failed to close database connection",
          error,
        );
      } else {
        throw new LabelerServerError(
          "Failed to close database connection",
          new Error(String(error)),
        );
      }
    }
  }

  /**
   * Creates a new signed label using the provided data.
   *
   * This function constructs an unsigned label with the current timestamp and
   * the source set to the provided source or the server's DID. It then signs
   * the label using the server's signing key and saves it to the database.
   *
   * @param data - The data required to create a label.
   * @param allowExpired - Whether to allow expired timestamps
   * @returns A promise that resolves to the signed label.
   * @throws {LabelerServerError} If validation fails or label creation fails
   */
  async createLabel(data: CreateLabelData, allowExpired: boolean = false): Promise<SignedLabel> {
    try {
      await this.getInitializationPromise();

      // Validate label value
      validateVal(data.val);

      // Validate URI
      validateUri(data.uri);

      // Validate URI and CID relationship
      if (data.uri.startsWith('did:')) {
        if (data.cid) {
          throw new AtProtocolValidationError("CID cannot be provided for DID URIs");
        }
      } else if (data.uri.startsWith('at://')) {
        if (data.cid) {
          validateCid(data.cid);
        } else {
          console.warn(
            'Warning: Creating a label for an at:// URI without a CID. ' +
            'Best practice is to include a CID for content-specific labels to reference a specific version. ' +
            'The client should obtain the appropriate CID for the content being labeled.'
          );
        }
      } else {
        throw new AtProtocolValidationError("URI must start with either \"did:\" or \"at://\"");
      }

      // Validate source DID if provided
      if (data.src) {
        validateDid(data.src);
      }

      // Generate current timestamp if not provided
      const cts = data.cts ?? new Date().toISOString();
      // Validate timestamps
      validateCts(cts);
      if (data.exp) {
        validateExp(data.exp, allowExpired);
      }

      const unsignedLabel: UnsignedLabel = {
        val: data.val,
        uri: data.uri,
        ...(data.cid ? { cid: data.cid } : {}),
        ...(data.neg ? { neg: true } : {}),
        exp: data.exp,
        cts,
        src: data.src ?? this.did,
      };

      // Sign the label
      const sig = await this._signer.sign(Buffer.from(JSON.stringify(unsignedLabel)));
      const signedLabel: SignedLabel = { ...unsignedLabel, sig: new Uint8Array(sig) };
      const savedLabel: SavedLabel = {
        ...unsignedLabel,
        sig: sig.buffer,
        id: this._nextId++,
      };

      await this.db.saveLabel(savedLabel);

      return signedLabel;
    } catch (error) {
      if (error instanceof AtProtocolValidationError) {
        throw new LabelerServerError(`Label validation failed: ${error.message}`, error);
      }
      throw new LabelerServerError(
        "Failed to create label",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Query all labels from the database.
   *
   * @param query - Optional query parameters
   * @returns A promise that resolves to an array of signed labels
   * @throws {LabelerServerError} If the query operation fails
   */
  async queryLabels(query?: { exp?: string; allowExpired?: boolean }): Promise<SignedLabel[]> {
    try {
      await this.getInitializationPromise();
      // Validate expiration timestamp if present
      if (query?.exp) {
        validateExp(query.exp, query.allowExpired);
      }

      const labels = await this.db.findLabels(query || {});

      if (!Array.isArray(labels)) {
        throw new Error("Invalid response from database");
      }

      // Filter out expired labels if allowExpired is not true
      const filteredLabels = !query?.allowExpired
        ? labels.filter(label => !label.exp || new Date(label.exp) > new Date())
        : labels;

      // Convert ArrayBuffer to Uint8Array for the signature
      return filteredLabels.map(label => ({
        ...label,
        sig: new Uint8Array(label.sig)
      }));
    } catch (error) {
      if (error instanceof AtProtocolValidationError) {
        throw new LabelerServerError(`Label validation failed: ${error.message}`, error);
      }
      throw new LabelerServerError(
        "Failed to query labels",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Query a specific label from the database by its ID.
   *
   * @param id - The ID of the label to query.
   * @returns A promise that resolves to the signed label if found, or null if not found.
   * @throws {LabelerServerError} If the query operation fails
   */
  async queryLabel(id: number): Promise<SignedLabel | null> {
    try {
      await this.getInitializationPromise();
      const label = await this.db.findOne({ id });

      if (!label) {
        return null;
      }

      return {
        val: label.val,
        uri: label.uri,
        cid: label.cid,
        neg: label.neg,
        exp: label.exp,
        cts: label.cts,
        src: label.src,
        sig: new Uint8Array(label.sig),
      };
    } catch (error) {
      throw new LabelerServerError(
        "Failed to query label",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Deletes a label from the database.
   *
   * This function first queries the label from the database to verify its existence.
   * If the label exists, it creates a new label with the same properties as the original,
   * but sets the neg field to true. It then signs the new label and saves it to the
   * database. If the label does not exist, the function does nothing.
   *
   * @param id - The ID of the label to delete.
   * @returns A promise that resolves to the signed label with negation if successful, or null if not found.
   * @throws {LabelerServerError} If the deletion operation fails
   */
  async deleteLabel(id: number): Promise<SignedLabel | null> {
    try {
      await this.getInitializationPromise();
      const label = await this.db.findOne({ id });

      if (!label) {
        return null;
      }

      // Validate the label value and timestamps before creating a new negated label
      validateVal(label.val);
      validateCts(label.cts);
      if (label.exp) {
        validateExp(label.exp);
      }

      const unsignedLabel: UnsignedLabel = {
        val: label.val,
        uri: label.uri,
        cid: label.cid,
        neg: true, // Always set to true when deleting
        exp: label.exp,
        cts: new Date().toISOString(),
        src: this._did,
      };

      const sig = await this._signer.sign(Buffer.from(JSON.stringify(unsignedLabel)));
      const negatedLabel: SignedLabel = { ...unsignedLabel, sig: new Uint8Array(sig) };
      const savedLabel: SavedLabel = {
        ...unsignedLabel,
        sig: sig.buffer,
        id: this._getNextId(), // Remove await since it's no longer async
      };

      try {
        await this.db.saveLabel(savedLabel); // Save as a new label instead of updating
      } catch (error) {
        throw new LabelerServerError(
          "Failed to save negated label to database",
          error instanceof Error ? error : new Error(String(error)),
        );
      }

      return negatedLabel;
    } catch (error) {
      if (error instanceof LabelerServerError) {
        throw error;
      }
      if (error instanceof AtProtocolValidationError) {
        throw new LabelerServerError(`Label validation failed: ${error.message}`, error);
      }
      throw new LabelerServerError(
        "Failed to delete label",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Reverses the negation of a label in the database.
   *
   * This function first queries the label from the database to verify its existence.
   * If the label exists, it creates a new label with the same properties as the original,
   * but sets the neg field to the opposite of the original. It then signs the new label.
   * If the save parameter is true, it saves the new label to the database. If the label
   * does not exist, the function does nothing.
   *
   * @param id - The ID of the label to reverse the negation of.
   * @param save - Whether to save the new label to the database. Defaults to false.
   * @returns A promise that resolves to the signed label with the reversed negation if
   * the label exists, or null if not.
   */
  async reverseLabelNegation(id: number, save = false): Promise<SignedLabel | null> {
    try {
      const labels = await this.db.findLabels({ id });
      if (!Array.isArray(labels) || labels.length === 0) {
        return null;
      }
      const label = labels[0];

      // Validate the label value and timestamps before creating a new one
      validateVal(label.val);
      validateCts(label.cts);
      if (label.exp) {
        validateExp(label.exp);
      }

      const unsignedLabel: UnsignedLabel = {
        val: label.val,
        uri: label.uri,
        cid: label.cid,
        neg: !label.neg,
        src: label.src,
        cts: label.cts,
        exp: label.exp,
      };
      const sig = await this._signer.sign(Buffer.from(JSON.stringify(unsignedLabel)));
      const signedLabel: SignedLabel = { ...unsignedLabel, sig: new Uint8Array(sig) };
      if (save) {
        const savedLabel: SavedLabel = {
          ...unsignedLabel,
          sig: sig.buffer,
          id,
        };
        await this.db.updateLabel(id, savedLabel);
      }
      return signedLabel;
    } catch (error) {
      if (error instanceof AtProtocolValidationError) {
        throw new LabelerServerError(`Label validation failed: ${error.message}`, error);
      }
      throw new LabelerServerError(
        "Failed to reverse label negation",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private _getNextId(): number {
    return this._nextId++;
  }
}
