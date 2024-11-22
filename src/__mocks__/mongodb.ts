import type { SavedLabel } from "../util/types.js";
import type { Filter, FindOptions } from "mongodb";
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
    // Convert ArrayBuffer to Binary when saving
    const savedLabel: MongoSavedLabel = {
      ...label,
      _id: new ObjectId(),
      sig: new Binary(Buffer.from(label.sig))
    };
    this.mockData.push(savedLabel);
    // Convert back to ArrayBuffer when returning
    return Promise.resolve({
      ...savedLabel,
      sig: savedLabel.sig.buffer
    });
  });

  constructor(uri: string, databaseName?: string, collectionName?: string) {
    // Constructor mock implementation
  }
}

export const MongoDBClient = jest.fn().mockImplementation(
  (uri: string, databaseName?: string, collectionName?: string) => {
    return new MockMongoDBClientImpl(uri, databaseName, collectionName);
  }
) as jest.MockedClass<typeof MockMongoDBClientImpl>;