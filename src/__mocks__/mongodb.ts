export class MongoDBClient {
  private labels: any[] = [];
  private counter = 0;
  private uri: string;
  private databaseName: string;
  private collectionName: string;

  constructor(uri: string, databaseName: string = 'labeler', collectionName: string = 'labels') {
    this.uri = uri;
    this.databaseName = databaseName;
    this.collectionName = collectionName;
  }

  async findLabels(query: any = {}, options: any = {}) {
    const { skip = 0, limit = 50 } = options;
    return this.labels.slice(skip, skip + limit);
  }

  async saveLabel(label: any) {
    const id = ++this.counter;
    const savedLabel = { 
      ...label,
      id,
      sig: Buffer.from(label.sig).toString('base64')  // Convert signature to base64 string
    };
    this.labels.push(savedLabel);
    return { ...savedLabel }; // Return a copy of the saved label
  }

  async getLabelsAfterCursor(cursor: number, limit: number) {
    return this.labels.filter(l => l.id > cursor).slice(0, limit);
  }

  async connect() {
    // Mock implementation
    return this;
  }

  async close() {
    // Mock implementation
  }
}
