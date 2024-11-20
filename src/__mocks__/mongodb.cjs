class MongoDBClient {
  constructor() {
    this.labels = [];
    this.counter = 0;
  }

  async findLabels(query = {}, options = {}) {
    const { skip = 0, limit = 50 } = options;
    return this.labels.slice(skip, skip + limit);
  }

  async insertLabel(label) {
    const id = ++this.counter;
    const savedLabel = { ...label, id };
    this.labels.push(savedLabel);
    return savedLabel;
  }

  async getLabelsAfterCursor(cursor, limit) {
    return this.labels.filter(l => l.id > cursor).slice(0, limit);
  }

  async connect() {
    // Mock implementation
  }

  async close() {
    // Mock implementation
  }
}

module.exports = { MongoDBClient };
