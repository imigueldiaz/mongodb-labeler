# MongoDB Labeler

[![npm version](https://img.shields.io/npm/v/@imigueldiaz/mongodb-labeler.svg)](https://www.npmjs.com/package/@imigueldiaz/mongodb-labeler)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NPM](https://img.shields.io/badge/npm-%23CB3837.svg?style=flat&logo=npm&logoColor=white)](https://www.npmjs.com/)
[![Vitest](https://img.shields.io/badge/tested_with-vitest-6E9F18?logo=vitest)](https://vitest.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![AT Protocol](https://img.shields.io/badge/AT_Protocol-compatible-blue)](https://atproto.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-%234ea94b.svg?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![codecov](https://codecov.io/gh/imigueldiaz/mongodb-labeler/graph/badge.svg?token=MRBW95LY97)](https://codecov.io/gh/imigueldiaz/mongodb-labeler)

<p align="center">
  <img src="assets/logo.svg" width="400" alt="MongoDB Labeler Logo">
</p>

A versatile data management and labeling tool that helps you organize, tag, and manage your MongoDB collections efficiently. Originally inspired by ATProtocol's labeling system, it can be used both for general MongoDB data labeling and ATProtocol content moderation.

## Acknowledgments

This project is a fork of [@skyware/labeler](https://github.com/skyware-js/labeler), which was originally designed for Bluesky/ATProto labeling. We've adapted and expanded it to work with MongoDB databases while maintaining compatibility with ATProtocol labeling workflows.

## Features

- Efficient data labeling interface
- MongoDB integration
- Support for custom label schemas
- ATProtocol compatibility
- Content moderation support
- Batch labeling operations
- Export and import functionality
- TypeScript support

## Installation

```bash
npm install @imigueldiaz/mongodb-labeler
```

### Requirements

- Node.js 22 or higher
- MongoDB 6.0 or higher
- npm (Node Package Manager)

## Usage

### Basic Usage

```typescript
import { LabelerServer } from "@imigueldiaz/mongodb-labeler";

// Initialize the labeler server
const labeler = new LabelerServer({
  did: "your-did",
  signingKey: "your-signing-key",
  mongoUri: "mongodb://localhost:27017",
  databaseName: "labeler", // optional, defaults to 'labeler'
  collectionName: "labels" // optional, defaults to 'labels'
});

// Create a label
const label = await labeler.createLabel({
  ver: 1,
  val: "label-value",
  uri: "at://did:example/repo/collection",
  cid: "bafyreib2rxk3rh6kzwq"
});

// Query labels
const labels = await labeler.queryLabels();

// Query specific label
const specificLabel = await labeler.queryLabel(1);

// Delete a label
const deletedLabel = await labeler.deleteLabel(1);

// Close the connection when done
await labeler.close();
```

### MongoDB Integration

The labeler uses MongoDB for data persistence. Make sure you have MongoDB running and accessible. The connection URI should follow MongoDB's connection string format:

```typescript
// Local MongoDB instance
const labeler = new LabelerServer({
  did: "your-did",
  signingKey: "your-signing-key",
  mongoUri: "mongodb://localhost:27017"
});

// MongoDB Atlas
const labeler = new LabelerServer({
  did: "your-did",
  signingKey: "your-signing-key",
  mongoUri: "mongodb+srv://username:password@cluster.mongodb.net"
});
```

## Configuration

The labeler can be configured with the following options:

```typescript
{
  /** The DID of the labeler account */
  did: string;

  /** The private signing key for the labeler */
  signingKey: string;

  /** MongoDB connection URI */
  mongoUri: string;

  /** The name of the MongoDB database to use (defaults to 'labeler') */
  databaseName?: string;

  /** The name of the MongoDB collection to use (defaults to 'labels') */
  collectionName?: string;
}
```

For basic MongoDB usage:

```typescript
import { MongoDBLabeler } from "@imigueldiaz/mongodb-labeler";

const labeler = new MongoDBLabeler({
  mongoUri: "mongodb://localhost:27017", // or "mongodb+srv://..."
  signingKey: "your-signing-key",
  did: "did:example:123",
  databaseName: "my_database",
  collectionName: "my_labels",
});
```

## ATProtocol Label Requirements

Labels in ATProtocol must follow specific requirements:

#### Label Structure

```typescript
{
  ver: 1,                // Version (always 1)
  val: "label-value",    // Label value (required)
  uri: "at://...",       // Subject URI (required)
  cid?: "bafy...",      // Content version (optional)
  neg?: boolean,         // Negation flag (optional)
  src?: "did:...",      // Source DID (optional)
  cts: "timestamp",      // Creation timestamp
  exp?: "timestamp"      // Expiration (optional)
}
```

#### Label Value Guidelines

- Use lowercase kebab-case (e.g., `label-name`)
- ASCII letters only (a-z)
- No punctuation except internal hyphens
- Maximum 128 bytes length
- Prefix with `!` for system-level labels

#### URI Requirements

- For labeling accounts: URI must start with `did:` (no CID allowed)
- For labeling content: URI must start with `at://` (CID recommended)

#### Example Labels

```typescript
// Labeling an account
const accountLabel = await labeler.createLabel({
  ver: 1,
  val: "account-status",
  uri: "did:plc:1234567890",
  src: "did:example:moderator"
});

// Labeling specific content
const contentLabel = await labeler.createLabel({
  ver: 1,
  val: "content-warning",
  uri: "at://did:example/repo/collection",
  cid: "bafyreib2rxk3rh6kzwq", // Specific version
  exp: "2024-12-31T23:59:59Z"  // Optional expiration
});
```

## Development

To set up the development environment:

```bash
# Clone the repository
git clone https://github.com/imigueldiaz/mongodb-labeler.git

# Install dependencies
npm install
```

### Available Scripts

- `npm run build` - Compiles TypeScript code
- `npm run lint` - Runs ESLint for code linting
- `npm run fmt` - Formats code using dprint
- `npm test` - Runs Vitest tests
- `npm run test:watch` - Runs tests in watch mode
- `npm run test:coverage` - Generates test coverage report

### Dependencies

#### Core Dependencies

- `@atproto/*` packages - For ATProtocol compatibility
- `fastify` (^5.1.0) - Web framework
- `mongodb` (^6.11.0) - MongoDB driver
- `date-fns` (^4.1.0) - Date utility library
- `ws` (^8.18.0) - WebSocket client and server

#### Development Dependencies

- `typescript` (^5.7.2) - TypeScript compiler
- `vitest` (^2.1.6) - Testing framework
- `@vitest/coverage-v8` - Code coverage tool
- `eslint` (^9.15.0) - Code linting
- `dprint` (^0.45.0) - Code formatting
- `mongodb-memory-server` - In-memory MongoDB for testing

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

- Ignacio de Miguel Díaz - [@imigueldiaz](https://github.com/imigueldiaz)

## Special Thanks

Special thanks to the [@skyware/labeler](https://github.com/skyware-js/labeler) team for their excellent work on the original project that served as the foundation for this tool.
