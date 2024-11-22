// Mock the mongodb import
jest.mock("../mongodb");

// Mock the crypto import
const mockImport = jest.fn();
const mockSign = jest.fn();
jest.mock('@atproto/crypto', () => ({
  Secp256k1Keypair: {
    import: mockImport,
  }
}));

jest.mock('../util/validators');

import { LabelerOptions, LabelerServer, LabelerServerError } from "../LabelerServer";
import { AtProtocolValidationError, validateDid } from "../util/validators";
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
		sig: new Uint8Array(32).buffer,
	};

	beforeEach(async () => {
		// Reset all mocks
		jest.clearAllMocks();
		
		// Setup mocks
		mockSign.mockResolvedValue(new Uint8Array(32));
		mockImport.mockResolvedValue({ sign: mockSign });
		(validateDid as jest.Mock).mockImplementation(() => undefined);

		// Setup MongoDB mock
		const db = new MongoDBClient("", "", "");
		mockDb = db as jest.Mocked<InstanceType<typeof MongoDBClient>>;
		mockDb.findLabels.mockResolvedValue([mockLabel]);
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
		if (server?.db) {
			await server.close();
		}
		jest.clearAllMocks();
	});

	describe("Label CRUD Operations", () => {
		beforeEach(() => {
			mockDb.findLabels.mockResolvedValue([mockLabel]);
		});

		it("should create a new label", async () => {
			const labelData = {
				uri: "at://did:web:test.com/app.bsky.feed.post/test",
				val: "test",
			};

			const label = await server.createLabel(labelData);

			expect(label).toBeDefined();
			expect(label.uri).toBe(labelData.uri);
			expect(label.val).toBe(labelData.val);
			expect(label.src).toBe(server.did);
			expect(label.sig).toBeInstanceOf(Uint8Array);
		});

		it("should query labels", async () => {
			const labels = await server.queryLabels();

			expect(labels).toHaveLength(1);
			expect(labels[0]).toMatchObject({
				src: "did:web:test.com",
				uri: "at://did:web:test.com/app.bsky.feed.post/test",
				val: "test",
			});
		});

		it("should return empty array when no labels exist", async () => {
			mockDb.findLabels.mockResolvedValue([]);
			const labels = await server.queryLabels();
			expect(labels).toHaveLength(0);
		});

		it("should delete a label", async () => {
			const labels = await server.queryLabels();
			expect(labels).toHaveLength(1);

			const deletedLabel = await server.deleteLabel(1);
			expect(deletedLabel).toBeDefined();
			expect(deletedLabel?.neg).toBe(true);
		});

		it("should reverse a label negation", async () => {
			const labels = await server.queryLabels();
			expect(labels).toHaveLength(1);

			const reversedLabel = await server.reverseLabelNegation(1);
			expect(reversedLabel).toBeDefined();
			expect(reversedLabel?.neg).toBe(true);
		});
	});

	describe('LabelerServerError', () => {
		it('should create an error with a custom message', () => {
		  const errorMessage = 'Test error message';
		  const error = new LabelerServerError(errorMessage);
		  
		  expect(error).toBeInstanceOf(Error);
		  expect(error).toBeInstanceOf(LabelerServerError);
		  expect(error.message).toBe(errorMessage);
		  expect(error.name).toBe('LabelerServerError');
		});
	  
		it('should create an error with a custom message and cause', () => {
		  const errorMessage = 'Test error message';
		  const originalError = new Error('Original error');
		  const error = new LabelerServerError(errorMessage, originalError);
		  
		  expect(error).toBeInstanceOf(Error);
		  expect(error).toBeInstanceOf(LabelerServerError);
		  expect(error.message).toBe(errorMessage);
		  expect(error.name).toBe('LabelerServerError');
		  expect(error.cause).toBe(originalError);
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
			// Mock Secp256k1Keypair.import
			mockImport.mockResolvedValue({ sign: mockSign });
			// Mock validateDid
			(validateDid as jest.Mock).mockImplementation(() => undefined);
		});

		it('should successfully initialize with valid options', async () => {
			// Create mock options
			const options: LabelerOptions = {
			  did: mockDid,
			  mongoUri: mockMongoUri,
			  databaseName: mockDatabaseName,
			  collectionName: mockCollectionName,
			  signingKey: mockSigningKey,
			};

			// Instantiate LabelerServer
			const labelerServer = new LabelerServer(options);

			// Verify DID validation was called
			expect(validateDid).toHaveBeenCalledWith(mockDid);

			// Verify MongoDBClient was instantiated with correct parameters
			expect(MongoDBClient).toHaveBeenCalledWith(
			  mockMongoUri, 
			  mockDatabaseName, 
			  mockCollectionName
			);

			// Verify signing key import was called
			expect(mockImport).toHaveBeenCalledWith(mockSigningKey);

			// Wait for async operations to complete
			await new Promise(process.nextTick);

			// Verify instance properties
			expect(labelerServer.did).toBe(mockDid);
			expect(labelerServer.db).toBeDefined();
		});

		it('should throw LabelerServerError for invalid DID', () => {
			// Mock validateDid to throw AtProtocolValidationError
			const error = new AtProtocolValidationError('Invalid DID format');
			(validateDid as jest.Mock).mockImplementation(() => {
			  throw error;
			});

			const options: LabelerOptions = {
			  did: 'did:plc:invalid' as `did:${string}`,
			  mongoUri: mockMongoUri,
			  signingKey: mockSigningKey,
			};

			// Expect constructor to throw LabelerServerError
			expect(() => {
				new LabelerServer(options);
			}).toThrow(LabelerServerError);
			expect(() => {
				new LabelerServer(options);
			}).toThrow('Invalid server configuration');
		});

		it('should handle async signer initialization', async () => {
			const mockKeypair = {
			  sign: jest.fn()
			};
			mockImport.mockResolvedValue(mockKeypair);

			const options: LabelerOptions = {
			  did: mockDid,
			  mongoUri: mockMongoUri,
			  signingKey: mockSigningKey,
			};

			// Instantiate LabelerServer
			const labelerServer = new LabelerServer(options);

			// Wait for async operations to complete
			await new Promise(process.nextTick);

			// Verify signer was set
			expect(labelerServer.signer).toBe(mockKeypair);
		});
	});
});