import { Secp256k1Keypair } from "@atproto/crypto";
import { MongoDBClient } from "./mongodb.js";
import { CreateLabelData, SignedLabel, UnsignedLabel } from "./util/types.js";

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
	private db: MongoDBClient;
	private did: `did:${string}`;
	private signer!: Secp256k1Keypair;

	constructor(options: LabelerOptions) {
		this.db = new MongoDBClient(options.mongoUri, options.databaseName, options.collectionName);
		this.did = options.did;

		// Initialize the signer
		void Secp256k1Keypair.import(options.signingKey).then((keypair) => {
			this.signer = keypair;
		});
	}

	/**
	 * Close the connection to the MongoDB instance.
	 *
	 * This method should be called when the LabelerServer is no longer needed.
	 */
	async close() {
		await this.db.close();
	}

	/**
	 * Creates a new signed label using the provided data.
	 *
	 * This function constructs an unsigned label with the current timestamp and
	 * the source set to the provided source or the server's DID. It then signs
	 * the label using the server's signing key and saves it to the database.
	 *
	 * @param data - The data required to create a label.
	 * @returns A promise that resolves to the signed label.
	 */
	async createLabel(data: CreateLabelData): Promise<SignedLabel> {
		const unsignedLabel: UnsignedLabel = {
			...data,
			cts: new Date().toISOString(),
			src: data.src || this.did,
		};

		const sig = await this.signer.sign(Buffer.from(JSON.stringify(unsignedLabel)));
		const signedLabel: SignedLabel = { ...unsignedLabel, sig: sig };
		await this.db.saveLabel(signedLabel);
		return signedLabel;
	}

	/**
	 * Query all labels from the database.
	 *
	 * @returns A promise that resolves to an array of signed labels.
	 */
	async queryLabels(): Promise<SignedLabel[]> {
		const labels = await this.db.findLabels({});
		// Convert ArrayBuffer to Uint8Array for signatures
		return labels.map((label) => ({ ...label, sig: new Uint8Array(label.sig) }));
	}

	/**
	 * Query a specific label from the database by its ID.
	 *
	 * @param id - The ID of the label to query.
	 * @returns A promise that resolves to the signed label if found, or null if not found.
	 */
	async queryLabel(id: number): Promise<SignedLabel | null> {
		const labels = await this.db.findLabels({ id });
		if (labels.length === 0) {
			return null;
		}
		const label = labels[0];
		// Convert ArrayBuffer to Uint8Array for signatures
		return { ...label, sig: new Uint8Array(label.sig) };
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
	 */
	async deleteLabel(id: number): Promise<SignedLabel | null> {
		const labels = await this.db.findLabels({ id });
		if (labels.length !== 1) {
			return null;
		}
		const labelToDelete: UnsignedLabel = { ...labels[0], neg: true};
		const sig = await this.signer.sign(Buffer.from(JSON.stringify(labelToDelete)));
		const signedlabelToDelete: SignedLabel = { ...labelToDelete, sig };
		await this.db.saveLabel(signedlabelToDelete);
		return signedlabelToDelete;
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
	async reverseLabelNegation(id: number, save: boolean = false): Promise<SignedLabel | null> {
		const labels = await this.db.findLabels({ id });
		if (labels.length !== 1) {
			return null;
		}
		const labelToReverse: UnsignedLabel = { ...labels[0], neg: !labels[0].neg};
		const sig = await this.signer.sign(Buffer.from(JSON.stringify(labelToReverse)));
		const signedlabelToDelete: SignedLabel = { ...labelToReverse, sig };
		if (save) {
			await this.db.saveLabel(signedlabelToDelete);
		}
		return signedlabelToDelete;
	}
}
