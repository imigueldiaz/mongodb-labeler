// Mock the mongodb import
jest.mock("../mongodb");

// Mock the crypto import
const mockImport = jest.fn();
const mockSign = jest.fn();
const mockSigner = {
  sign: mockSign,
};
jest.mock('@atproto/crypto', () => ({
  Secp256k1Keypair: {
    import: mockImport.mockResolvedValue(mockSigner),
  }
}));

jest.mock('../util/validators');

import { LabelerOptions, LabelerServer, LabelerServerError } from "../LabelerServer";
import { AtProtocolValidationError, validateAtUri, validateCid, validateDid } from "../util/validators";
import { MongoDBClient } from "../mongodb";
import { ObjectId } from "mongodb";

describe("LabelerServer", () => {
	let server: LabelerServer;
	let mockDb: jest.Mocked<InstanceType<typeof MongoDBClient>>;
	const mockObjectId = new ObjectId("test-id");
	const mockLabel = {
		_id: mockObjectId,
		id: 1,
		src: "did:web:test.com" as `did:${string}`,
		uri: "at://did:web:test.com/app.bsky.feed.post/test",
		val: "test",
		cts: new Date().toISOString(),
		sig: new Uint8Array(32),
		neg: false
	};

	beforeEach(async () => {
		// Reset all mocks
		jest.clearAllMocks();
		
		// Setup mocks
		mockSign.mockResolvedValue(new Uint8Array(32));
		(validateDid as jest.Mock).mockImplementation(() => undefined);
		(validateAtUri as jest.Mock).mockImplementation((uri: string) => {
			if (uri === "invalid-uri") {
				throw new AtProtocolValidationError("Invalid URI");
			}
		});
		(validateCid as jest.Mock).mockImplementation((cid: string) => {
			if (cid === "invalid-cid") {
				throw new AtProtocolValidationError("Invalid CID");
			}
		});

		// Setup MongoDB mock
		const db = new MongoDBClient("", "", "");
		mockDb = db as jest.Mocked<InstanceType<typeof MongoDBClient>>;
		mockDb.findLabels.mockResolvedValue([mockLabel]);
		mockDb.close.mockResolvedValue();
		(MongoDBClient as jest.MockedClass<typeof MongoDBClient>).mockReturnValue(mockDb);

		const options: LabelerOptions = {
			did: "did:web:test.com" as `did:${string}`,
			mongoUri: "mongodb://localhost:27017",
			signingKey: "test-key",
		};

		server = new LabelerServer(options);
		// Wait for signer initialization
		await new Promise(process.nextTick);
	});

	afterEach(async () => {
		try {
			if (server?.db) {
				await server.close();
			}
		} catch (error) {
			// Ignore close errors in cleanup
		}
		jest.clearAllMocks();
	});

	describe("Label CRUD Operations", () => {
		beforeEach(() => {
			mockDb.findLabels.mockResolvedValue([mockLabel]);
		});

		describe("createLabel", () => {
			const validLabel = {
				uri: "at://did:web:test.com/app.bsky.feed.post/test",
				cid: "bafybeigdyrzt5sfp7udm7hu76kqbmtxwmgaslqbm25j6lwsxzd53kbcpea",
				val: "test",
				neg: false
			};

			it("should create a label successfully", async () => {
				mockDb.saveLabel.mockResolvedValue(mockLabel);
				const result = await server.createLabel(validLabel);
				expect(result).toBeDefined();
				expect(result.uri).toBe(validLabel.uri);
				expect(result.val).toBe(validLabel.val);
				expect(result.neg).toBe(validLabel.neg);
			});

			it("should throw error when URI validation fails", async () => {
				const invalidLabel = { ...validLabel, uri: "invalid-uri" };
				await expect(server.createLabel(invalidLabel)).rejects.toThrow(LabelerServerError);
			});

			it("should throw error when CID validation fails", async () => {
				const invalidLabel = { ...validLabel, cid: "invalid-cid" };
				await expect(server.createLabel(invalidLabel)).rejects.toThrow(LabelerServerError);
			});

			it("should throw error when database operation fails", async () => {
				mockDb.saveLabel.mockRejectedValue(new Error("Database error"));
				await expect(server.createLabel(validLabel)).rejects.toThrow(LabelerServerError);
			});
		});

		describe("queryLabels", () => {
			it("should return all labels", async () => {
				const labels = await server.queryLabels();
				expect(labels).toHaveLength(1);
				expect(labels[0]).toEqual(mockLabel);
			});

			it("should handle database errors", async () => {
				mockDb.findLabels.mockRejectedValue(new Error("Database error"));
				await expect(server.queryLabels()).rejects.toThrow(LabelerServerError);
			});
		});

		describe("queryLabel", () => {
			it("should return null for non-existent label", async () => {
				mockDb.findLabels.mockResolvedValue([]);
				const label = await server.queryLabel(999);
				expect(label).toBeNull();
			});

			it("should return label when found", async () => {
				const label = await server.queryLabel(1);
				expect(label).toEqual(mockLabel);
			});

			it("should handle database errors", async () => {
				mockDb.findLabels.mockRejectedValue(new Error("Database error"));
				await expect(server.queryLabel(1)).rejects.toThrow(LabelerServerError);
			});
		});

		describe("deleteLabel", () => {
			it("should return null for non-existent label", async () => {
				mockDb.findLabels.mockResolvedValue([]);
				const result = await server.deleteLabel(999);
				expect(result).toBeNull();
			});

			it("should create negation for existing label", async () => {
				const negatedLabel = { ...mockLabel, neg: true };
				mockDb.saveLabel.mockResolvedValue(negatedLabel);
				const result = await server.deleteLabel(1);
				expect(result).toBeDefined();
				expect(result?.neg).toBe(true);
			});

			it("should handle database errors", async () => {
				mockDb.saveLabel.mockRejectedValue(new Error("Database error"));
				await expect(server.deleteLabel(1)).rejects.toThrow(LabelerServerError);
			});
		});

		describe("reverseLabelNegation", () => {
			it("should return null for non-existent label", async () => {
				mockDb.findLabels.mockResolvedValue([]);
				const result = await server.reverseLabelNegation(999);
				expect(result).toBeNull();
			});

			it("should reverse negation without saving", async () => {
				const result = await server.reverseLabelNegation(1, false);
				expect(result).toBeDefined();
				expect(result?.neg).toBe(!mockLabel.neg);
				expect(mockDb.saveLabel).not.toHaveBeenCalled();
			});

			it("should reverse negation and save", async () => {
				const reversedLabel = { ...mockLabel, neg: !mockLabel.neg };
				mockDb.saveLabel.mockResolvedValue(reversedLabel);
				const result = await server.reverseLabelNegation(1, true);
				expect(result).toBeDefined();
				expect(result?.neg).toBe(!mockLabel.neg);
				expect(mockDb.saveLabel).toHaveBeenCalled();
			});

			it("should handle database errors when saving", async () => {
				mockDb.saveLabel.mockRejectedValue(new Error("Database error"));
				await expect(server.reverseLabelNegation(1, true)).rejects.toThrow(LabelerServerError);
			});
		});
	});

	describe("close", () => {
		it("should close database connection", async () => {
			mockDb.close.mockResolvedValue();
			await expect(server.close()).resolves.toBeUndefined();
			expect(mockDb.close).toHaveBeenCalled();
		});

		it("should handle database close errors", async () => {
			mockDb.close.mockRejectedValue(new Error("Close error"));
			await expect(server.close()).rejects.toThrow(LabelerServerError);
		});
	});

	describe('LabelerServerError', () => {
		it('should create an error with a custom message', () => {
			const errorMessage = 'Test error message';
			const error = new LabelerServerError(errorMessage);
			expect(error.message).toBe(errorMessage);
			expect(error.name).toBe('LabelerServerError');
		});

		it('should create an error with a custom message and cause', () => {
			const errorMessage = 'Test error message';
			const cause = new Error('Test cause');
			const error = new LabelerServerError(errorMessage, cause);
			expect(error.message).toBe(errorMessage);
			expect(error.cause).toBe(cause);
		});
	});

	describe('LabelerServer Constructor', () => {
		const mockMongoUri = 'mongodb://localhost:27017';
		const mockDatabaseName = 'testLabeler';
		const mockCollectionName = 'testLabels';
		const mockDid = 'did:example:test';
		const mockSigningKey = 'base64encodedkey';

		beforeEach(() => {
			jest.clearAllMocks();
			mockImport.mockResolvedValue(mockSigner);
			(validateDid as jest.Mock).mockImplementation(() => undefined);
		});

		it('should successfully initialize with valid options', async () => {
			const options: LabelerOptions = {
				did: mockDid as `did:${string}`,
				mongoUri: mockMongoUri,
				databaseName: mockDatabaseName,
				collectionName: mockCollectionName,
				signingKey: mockSigningKey,
			};

			const labelerServer = new LabelerServer(options);
			expect(validateDid).toHaveBeenCalledWith(mockDid);
			expect(MongoDBClient).toHaveBeenCalledWith(
				mockMongoUri, 
				mockDatabaseName, 
				mockCollectionName
			);
			expect(mockImport).toHaveBeenCalledWith(mockSigningKey);

			await new Promise(process.nextTick);
			expect(labelerServer.did).toBe(mockDid);
			expect(labelerServer.db).toBeDefined();
		});

		it('should throw LabelerServerError for invalid DID', () => {
			const error = new AtProtocolValidationError('Invalid DID format');
			(validateDid as jest.Mock).mockImplementation(() => {
				throw error;
			});

			const options: LabelerOptions = {
				did: 'invalid:did' as `did:${string}`,
				mongoUri: mockMongoUri,
				signingKey: mockSigningKey,
			};

			expect(() => new LabelerServer(options)).toThrow(LabelerServerError);
		});

		it('should handle signer initialization errors', async () => {
			const error = new Error('Import error');
			mockImport.mockRejectedValue(error);

			const options: LabelerOptions = {
				did: mockDid as `did:${string}`,
				mongoUri: mockMongoUri,
				signingKey: mockSigningKey,
			};

			const labelerServer = new LabelerServer(options);
			await expect(new Promise((resolve) => {
				process.nextTick(() => {
					try {
						labelerServer.signer;
						resolve(undefined);
					} catch (e) {
						resolve(e);
					}
				});
			})).resolves.toBeInstanceOf(LabelerServerError);
		});
	});
});