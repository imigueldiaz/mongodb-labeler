import { Collection, Db, Filter, FindOptions, MongoClient } from "mongodb";
import type { SavedLabel, UnsignedLabel } from "./util/types.js";

interface Counter {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  _id: string;
  sequenceValue: number;
}

/**
 * Client for interacting with the MongoDB database where labels are stored.
 *
 * This class handles connecting to the database, creating necessary indexes,
 * and performing basic CRUD operations on labels.
 *
 * @param uri The URI to connect to the MongoDB instance.
 * @param databaseName The name of the database to use. Defaults to 'labeler'.
 * @param collectionName The name of the collection to use. Defaults to 'labels'.
 */
export class MongoDBClient {
  private _db?: Db;
  private _client?: MongoClient;
  private _labels?: Collection<SavedLabel>;
  private readonly _url: string;

  /**
   * Create a new MongoDBClient instance.
   * @param uri The URI to connect to the MongoDB instance.
   */
  constructor(uri: string) {
    if (!uri) {
      throw new Error("Missing required parameter: mongoUri");
    }
    if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
      throw new Error("Invalid scheme, expected connection string to start with \"mongodb://\" or \"mongodb+srv://\"");
    }
    this._url = uri;
  }

  /**
   * Connect to the MongoDB instance and initialize the collection.
   * If the collection doesn't exist, it will be created with the necessary indexes.
   *
   * This method should be called before any other method in this class.
   */
  async connect(): Promise<void> {
    try {
      this._client = await MongoClient.connect(this._url);
      this._db = this._client.db();
      this._labels = this._db.collection("labels");

      // Verificar si la colección existe
      const collections = await this._db.listCollections({ name: "labels" }).toArray();
      const collectionExists = collections.length > 0;

      if (!collectionExists) {
        console.log(`Creating collection labels`);
        // Crear la colección explícitamente
        await this._db.createCollection("labels");

        // Obtener referencia a la colección recién creada
        this._labels = this._db.collection("labels");

        console.log(`Creating indexes for new collection labels`);
        // Crear los índices necesarios
        await this._labels.createIndex({ uri: 1 });
        await this._labels.createIndex({ src: 1 });
        await this._labels.createIndex({ id: 1 }, { unique: true });
      } else {
        // Si la colección ya existe, solo obtener la referencia
        this._labels = this._db.collection("labels");
      }
    } catch (error) {
      throw new Error(
        `Failed to connect to MongoDB: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Close the connection to MongoDB.
   */
  async close(): Promise<void> {
    if (!this._client) {
      return;
    }

    try {
      await this._client.close();
    } catch (error) {
      const wrappedError = new Error(
        `Failed to close MongoDB client: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw wrappedError;
    }
  }

  /**
   * Save a label to the MongoDB collection with an automatically generated ID.
   *
   * @param label - The label to save, including a signature as an ArrayBuffer.
   * @returns A promise that resolves to the saved label with an assigned ID.
   */
  async saveLabel(label: UnsignedLabel & { sig: ArrayBuffer }): Promise<SavedLabel> {
    if (!this._labels) {
      throw new Error("Failed to save label: Collection is not initialized");
    }

    try {
      const id = await this._getNextId();
      const savedLabel: SavedLabel = { ...label, id };
      const result = await this._labels.insertOne(savedLabel);

      if (!result.acknowledged) {
        throw new Error("Operation not acknowledged");
      }

      return savedLabel;
    } catch (error) {
      // If the error is from _getNextId, propagate it as is since it's already properly formatted
      if (error instanceof Error && error.message.startsWith('Failed to get next ID')) {
        throw error;
      }
      // For other errors, wrap them with the saveLabel context
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to save label: ${message}`);
    }
  }

  /**
   * Find labels in the MongoDB collection matching the given query.
   *
   * @param query - The query object to filter labels.
   * @param options - Optional settings for the query, such as sort and limit.
   * @returns A promise that resolves to an array of labels matching the query.
   */
  async findLabels(query: Filter<SavedLabel> & { allowExpired?: boolean } = {}, options: FindOptions<SavedLabel> = {}): Promise<SavedLabel[]> {
    if (!this._labels) {
      return [];
    }

    try {
      const { allowExpired, ...restQuery } = query;
      let finalQuery = restQuery;

      // Solo filtrar etiquetas expiradas si allowExpired es false
      if (!allowExpired) {
        const now = new Date().toISOString();
        finalQuery = {
          ...restQuery,
          $or: [
            { exp: { $exists: false } },
            { exp: { $gt: now } }
          ]
        };
      }

      return await this._labels.find(finalQuery, options).toArray();
    } catch (error) {
      throw new Error(
        `Failed to find labels: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Find a single label in the MongoDB collection matching the given query.
   *
   * @param query - The query object to filter labels.
   * @returns A promise that resolves to the matching label or null if not found.
   */
  async findOne(query: Filter<SavedLabel>): Promise<SavedLabel | null> {
    if (!this._labels) {
      return null;
    }

    try {
      return await this._labels.findOne(query);
    } catch (error) {
      throw new Error(
        `Failed to find label: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Retrieve a limited number of labels from the database that have an ID greater than the specified cursor.
   *
   * @param cursor - The ID after which labels should be retrieved.
   * @param limit - The maximum number of labels to return.
   * @returns A promise that resolves to an array of labels with IDs greater than the cursor.
   */
  async getLabelsAfterCursor(cursor: number, limit: number): Promise<SavedLabel[]> {
    try {
      return this._labels?.find({ id: { $gt: cursor } }).sort({ id: 1 }).limit(limit).toArray() ?? [];
    } catch (error) {
      throw new Error(
        `Failed to get labels after cursor: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Retrieve the next available ID for a label using atomic operations.
   * 
   * This method uses MongoDB's findOneAndUpdate with upsert to atomically increment
   * a counter, ensuring unique IDs even under concurrent operations.
   * 
   * @returns A promise that resolves to the next available ID.
   */
  private async _getNextId(): Promise<number> {
    if (!this._db) {
      throw new Error("Failed to get next ID: Database is not initialized");
    }

    try {
      const counters = this._db.collection<Counter>('counters');
      const result = await counters.findOneAndUpdate(
        // eslint-disable-next-line @typescript-eslint/naming-convention
        { _id: 'labelId' },
        { $inc: { sequenceValue: 1 } },
        { 
          upsert: true,
          returnDocument: 'after'
        }
      );

      if (!result) {
        throw new Error("No result returned from findOneAndUpdate");
      }

      return result.sequenceValue;
    } catch (error) {
      // Wrap all errors with the "Failed to get next ID" prefix
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get next ID: ${message}`);
    }
  }

  /**
   * Update an existing label in the MongoDB collection.
   *
   * @param id - The ID of the label to update.
   * @param label - The new label data.
   * @returns A promise that resolves to true if the update was successful, false if the label wasn't found.
   */
  async updateLabel(id: number, label: UnsignedLabel & { sig: ArrayBuffer }): Promise<boolean> {
    if (!this._labels) {
      throw new Error("Collection is not initialized");
    }

    try {
      const result = await this._labels.updateOne(
        { id },
        { $set: label },
      );
      return result.modifiedCount > 0;
    } catch (error) {
      throw new Error(
        `Failed to update label: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
