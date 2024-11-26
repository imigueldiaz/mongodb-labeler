import { Collection, Db, Filter, FindOptions, MongoClient } from "mongodb";
import type { SavedLabel, UnsignedLabel } from "./util/types.js";

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
  private _client: MongoClient;
  private _db: Db | undefined;
  private _labels: Collection<SavedLabel> | undefined;
  private _databaseName: string;
  private _collectionName: string;

  /**
   * Create a new MongoDBClient instance.
   * @param uri The URI to connect to the MongoDB instance.
   * @param databaseName The name of the database to use. Defaults to 'labeler'.
   * @param collectionName The name of the collection to use. Defaults to 'labels'.
   */
  constructor(uri: string, databaseName = "labeler", collectionName = "labels") {
    if (!uri) {
      throw new Error("Missing required parameter: mongoUri");
    }
    if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
      throw new Error("Invalid scheme, expected connection string to start with \"mongodb://\" or \"mongodb+srv://\"");
    }
    this._client = new MongoClient(uri);
    this._databaseName = databaseName;
    this._collectionName = collectionName;
  }

  /**
   * Connect to the MongoDB instance and initialize the collection.
   * If the collection doesn't exist, it will be created with the necessary indexes.
   *
   * This method should be called before any other method in this class.
   */
  async connect(): Promise<void> {
    try {
      await this._client.connect();
      this._db = this._client.db(this._databaseName);

      // Verificar si la colección existe
      const collections = await this._db.listCollections({ name: this._collectionName }).toArray();
      const collectionExists = collections.length > 0;

      if (!collectionExists) {
        console.log(`Creating collection ${this._collectionName}`);
        // Crear la colección explícitamente
        await this._db.createCollection(this._collectionName);

        // Obtener referencia a la colección recién creada
        this._labels = this._db.collection(this._collectionName);

        console.log(`Creating indexes for new collection ${this._collectionName}`);
        // Crear los índices necesarios
        await this._labels.createIndex({ uri: 1 });
        await this._labels.createIndex({ src: 1 });
        await this._labels.createIndex({ id: 1 }, { unique: true });
      } else {
        // Si la colección ya existe, solo obtener la referencia
        this._labels = this._db.collection(this._collectionName);
      }
    } catch (error) {
      throw new Error(
        `Failed to connect to MongoDB: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Close the connection to the MongoDB instance.
   *
   * This method should be called when the MongoDBClient is no longer needed.
   */
  async close(): Promise<void> {
    if (!this._db) {
      throw new Error("Client is not initialized");
    }

    try {
      await this._client.close();
    } catch (error) {
      const wrappedError = new Error(
        `Failed to close MongoDB client: ${error instanceof Error ? error.message : String(error)}`,
      );
      wrappedError.cause = error;
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
    try {
      const nextId = await this._getNextId();
      const labelToSave = { ...label, id: nextId };

      await this._labels?.insertOne(labelToSave);

      return labelToSave;
    } catch (error) {
      throw new Error(
        `Failed to save label: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Find labels in the MongoDB collection matching the given query.
   *
   * @param query - The query object to filter labels.
   * @param options - Optional settings for the query, such as sort and limit.
   * @returns A promise that resolves to an array of labels matching the query.
   */
  async findLabels(query: Filter<SavedLabel>, options: FindOptions<SavedLabel> = {}): Promise<SavedLabel[]> {
    if (!this._labels) {
      return [];
    }

    try {
      // Filtrar etiquetas expiradas
      const now = new Date().toISOString();
      const finalQuery = {
        ...query,
        $or: [
          { exp: { $exists: false } },
          { exp: { $gt: now } }
        ]
      };
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
   * Retrieve the next available ID for a new label.
   *
   * This method finds the label with the highest existing ID in the collection.
   * If no labels exist, it starts from 1. Otherwise, it increments the highest ID by 1.
   *
   * @returns A promise that resolves to the next available ID.
   */
  private async _getNextId(): Promise<number> {
    try {
      const lastLabel = await this._labels?.findOne({}, { sort: { id: -1 } });
      return (lastLabel?.id ?? 0) + 1;
    } catch (error) {
      throw new Error(
        `Failed to get next ID: ${error instanceof Error ? error.message : String(error)}`,
      );
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
