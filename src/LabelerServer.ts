import { MongoDBClient } from "./mongodb.js";
import { Secp256k1Keypair } from '@atproto/crypto';
import {
    CreateLabelData,
    UnsignedLabel,
    SignedLabel,
} from "./util/types.js";

export interface LabelerOptions {
    did: string;
    signingKey: string;
    mongoUri: string;
    databaseName?: string;
    collectionName?: string;
    port?: number;
}

export class LabelerServer {
    private db: MongoDBClient;
    private did: string;
    private signer!: Secp256k1Keypair;

    constructor(options: LabelerOptions) {
        this.db = new MongoDBClient(options.mongoUri, options.databaseName, options.collectionName);
        this.did = options.did;
        
        // Initialize the signer
        void Secp256k1Keypair.import(options.signingKey).then(keypair => {
            this.signer = keypair;
        });
    }

    async close() {
        await this.db.close();
    }

    async createLabel(data: CreateLabelData): Promise<SignedLabel> {
        const unsignedLabel: UnsignedLabel = {
            ...data,
            cts: new Date().toISOString(),
        };

        const sig = await this.signer.sign(Buffer.from(JSON.stringify(unsignedLabel)));
        
        const signedLabel: SignedLabel = {
            ...unsignedLabel,
            sig: sig,
        };

        await this.db.saveLabel(signedLabel);
        return signedLabel;
    }

    async queryLabels(): Promise<SignedLabel[]> {
        const labels = await this.db.findLabels({});
        // Convert ArrayBuffer to Uint8Array for signatures
        return labels.map(label => ({
            ...label,
            sig: new Uint8Array(label.sig)
        }));
    }
}