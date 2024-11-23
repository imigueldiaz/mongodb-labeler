import type { SavedLabel } from "../util/types.js";
import { Binary } from "mongodb";

// Mock ObjectId class
export class ObjectId {
  _bsontype = "ObjectID";
  id = Buffer.from("mock-object-id");

  constructor(id?: string) {
    if (id) {
      this.id = Buffer.from(id);
    }
  }

  toHexString() {
    return this.id.toString("hex");
  }

  toString() {
    return this.toHexString();
  }

  toJSON() {
    return this.toHexString();
  }

  equals(otherId: ObjectId) {
    return this.id.equals(otherId.id);
  }

  getTimestamp() {
    return new Date();
  }
}

type MongoSavedLabel = Omit<SavedLabel, 'sig'> & {
  _id: ObjectId;
  sig: Binary;
};

class MockMongoDBClientImpl {
  private mockData: MongoSavedLabel[] = [];

  connect = jest.fn().mockResolvedValue(undefined);
  close = jest.fn().mockResolvedValue(undefined);
  
  findLabels = jest.fn().mockImplementation(() => {
    // Convert Binary to ArrayBuffer when returning
    return Promise.resolve(
      this.mockData.map(label => ({
        ...label,
        sig: label.sig.buffer
      }))
    );
  });

  saveLabel = jest.fn().mockImplementation((label: SavedLabel) => {
    const mongoLabel: MongoSavedLabel = {
      ...label,
      _id: new ObjectId(),
      sig: new Binary(Buffer.from(label.sig))
    };
    this.mockData.push(mongoLabel);
    return Promise.resolve({
      ...mongoLabel,
      sig: mongoLabel.sig.buffer
    });
  });
}

export const MongoDBClient = jest.fn().mockImplementation(() => {
  return new MockMongoDBClientImpl();
}) as jest.MockedClass<typeof MockMongoDBClientImpl>;