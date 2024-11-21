// Mock the mongodb import
jest.mock("../mongodb");

import { LabelerServer } from "../LabelerServer";

describe("LabelerServer", () => {
	let server: LabelerServer;

	beforeEach(() => {
		server = new LabelerServer({
			did: "did:example:test" as `did:${string}`,
			signingKey: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			mongoUri: "mongodb://mock",
			port: 4100,
		});
	});

	afterEach(async () => {
		await server.close();
		jest.clearAllMocks();
	});

	describe("Label CRUD Operations", () => {
		it("should create a new label", async () => {
			const labelData = {
				uri: "at://did:example:test/app.bsky.feed.post/test",
				src: "did:example:test" as `did:${string}`,
				val: "test-label",
				neg: false,
			};

			const savedLabel = await server.createLabel(labelData);

			expect(savedLabel).toMatchObject({ ...labelData, sig: expect.any(Uint8Array) });
		});

		it("should query labels", async () => {
			// First create a label to ensure there's data
			const labelData = {
				uri: "at://did:example:test/app.bsky.feed.post/test",
				src: "did:example:test" as `did:${string}`,
				val: "test-label",
				neg: false,
			};
			await server.createLabel(labelData);

			const labels = await server.queryLabels();

			expect(labels).toHaveLength(1);
			expect(labels[0]).toMatchObject({
				src: "did:example:test" as `did:${string}`,
				uri: "at://did:example:test/app.bsky.feed.post/test",
				val: "test-label",
				sig: expect.any(Uint8Array),
			});
		});

		it("should return empty array when no labels exist", async () => {
			const labels = await server.queryLabels();
			expect(labels).toEqual([]);
		});

		it("should delete a label", async () => {
			// First create a label to ensure there's data
			const labelData = {
				uri: "at://did:example:test/app.bsky.feed.post/test",
				src: "did:example:test" as `did:${string}`,
				val: "test-label",
				neg: false,
			};
			await server.createLabel(labelData);

			const labels = await server.queryLabels();
			expect(labels).toHaveLength(1);

			// Delete the label
			const deletedLabel = await server.deleteLabel(1);
			expect(deletedLabel).not.toBeNull();
			expect(deletedLabel?.neg).toBe(true);
			expect(deletedLabel?.sig).toBeInstanceOf(Uint8Array);
		});

		it("should reverse a label negation", async () => {
			// First create a label to ensure there's data
			const labelData = {
				uri: "at://did:example:test/app.bsky.feed.post/test",
				src: "did:example:test" as `did:${string}`,
				val: "test-label",
				neg: false,
			};
			await server.createLabel(labelData);

			const labels = await server.queryLabels();
			expect(labels).toHaveLength(1);

			// Reverse the label negation
			const reversedLabel = await server.reverseLabelNegation(1);
			expect(reversedLabel).not.toBeNull();
			expect(reversedLabel?.neg).toBe(true);
			expect(reversedLabel?.sig).toBeInstanceOf(Uint8Array);
		});
	});
});
