import type { SavedLabel } from "../util/types.js";

export class MongoDBClient {
	private labels: SavedLabel[] = [];
	private nextId = 1;

	constructor(
		private mongoUri: string,
		private databaseName?: string,
		private collectionName?: string,
	) {}

	// eslint-disable-next-line @typescript-eslint/require-await
	async findLabels(
		_query: any,
		options?: { sort?: any; skip?: number; limit?: number },
	): Promise<SavedLabel[]> {
		const { skip = 0, limit = 50 } = options ?? {};
		return this.labels.slice(skip, skip + limit);
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	async saveLabel(label: SavedLabel): Promise<SavedLabel> {
		const savedLabel = { ...label, id: this.nextId++ };
		this.labels.push(savedLabel);
		return savedLabel;
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	async getLabelsAfterCursor(cursor: number, limit: number): Promise<SavedLabel[]> {
		return this.labels.filter((l) => l.id > cursor).slice(0, limit);
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	async connect(): Promise<void> {
		// Mock implementation
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	async close(): Promise<void> {
		// Mock implementation
	}
}
