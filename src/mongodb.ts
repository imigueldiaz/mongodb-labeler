import { MongoClient, Collection, Db } from 'mongodb';
import type { SavedLabel, UnsignedLabel } from './util/types.js';

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
    private client: MongoClient;
    private db: Db;
    private labels: Collection<SavedLabel>;
    private databaseName: string;
    private collectionName: string;

    /**
     * Create a new MongoDBClient instance.
     * @param uri The URI to connect to the MongoDB instance.
     * @param databaseName The name of the database to use. Defaults to 'labeler'.
     * @param collectionName The name of the collection to use. Defaults to 'labels'.
     */
    constructor(uri: string, databaseName: string = 'labeler', collectionName: string = 'labels') {
        this.client = new MongoClient(uri);
        this.databaseName = databaseName;
        this.collectionName = collectionName;
    }

    /**
     * Connect to the MongoDB instance and initialize the collection.
     * If the collection doesn't exist, it will be created with the necessary indexes.
     *
     * This method should be called before any other method in this class.
     */
    async connect() {
        await this.client.connect();
        this.db = this.client.db(this.databaseName);
        
        // Verificar si la colección existe
        const collections = await this.db.listCollections({ name: this.collectionName }).toArray();
        const collectionExists = collections.length > 0;
        
        if (!collectionExists) {
            console.log(`Creating collection ${this.collectionName}`);
            // Crear la colección explícitamente
            await this.db.createCollection(this.collectionName);
            
            // Obtener referencia a la colección recién creada
            this.labels = this.db.collection(this.collectionName);
            
            console.log(`Creating indexes for new collection ${this.collectionName}`);
            // Crear los índices necesarios
            await this.labels.createIndex({ uri: 1 });
            await this.labels.createIndex({ src: 1 });
            await this.labels.createIndex({ id: 1 }, { unique: true });
        } else {
            // Si la colección ya existe, solo obtener la referencia
            this.labels = this.db.collection(this.collectionName);
        }
    }

    /**
     * Close the connection to the MongoDB instance.
     *
     * This method should be called when the MongoDBClient is no longer needed.
     */
    async close() {
        await this.client.close();
    }

    /**
     * Save a label to the MongoDB collection with an automatically generated ID.
     * 
     * @param label - The label to save, including a signature as an ArrayBuffer.
     * @returns A promise that resolves to the saved label with an assigned ID.
     */
    async saveLabel(label: UnsignedLabel & { sig: ArrayBuffer }): Promise<SavedLabel> {
        const nextId = await this.getNextId();
        const labelToSave = {
            ...label,
            id: nextId
        };

        await this.labels.insertOne(labelToSave);

        return labelToSave;
    }

    /**
     * Find labels in the MongoDB collection matching the given query.
     * 
     * @param query - The query object to filter labels.
     * @param options - Optional settings for the query, such as sort and limit.
     * @returns A promise that resolves to an array of labels matching the query.
     */
    async findLabels(query: any, options: any = {}) {
        return this.labels.find(query, options).toArray();
    }

    /**
     * Retrieve a limited number of labels from the database that have an ID greater than the specified cursor.
     *
     * @param cursor - The ID after which labels should be retrieved.
     * @param limit - The maximum number of labels to return.
     * @returns A promise that resolves to an array of labels with IDs greater than the cursor.
     */
    async getLabelsAfterCursor(cursor: number, limit: number) {
        return this.labels.find({ id: { $gt: cursor } })
            .sort({ id: 1 })
            .limit(limit)
            .toArray();
    }

    /**
     * Retrieve the next available ID for a new label.
     *
     * This method finds the label with the highest existing ID in the collection.
     * If no labels exist, it starts from 1. Otherwise, it increments the highest ID by 1.
     *
     * @returns A promise that resolves to the next available ID.
     */
    private async getNextId(): Promise<number> {
        const lastLabel = await this.labels.findOne({}, { sort: { id: -1 } });
        return (lastLabel?.id ?? 0) + 1;
    }
}
