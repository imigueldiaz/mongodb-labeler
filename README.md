# MongoDB Labeler

[![npm version](https://img.shields.io/npm/v/@imigueldiaz/mongodb-labeler.svg)](https://www.npmjs.com/package/@imigueldiaz/mongodb-labeler)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NPM](https://img.shields.io/badge/npm-%23CB3837.svg?style=flat&logo=npm&logoColor=white)](https://www.npmjs.com/)
[![Jest](https://img.shields.io/badge/tested_with-jest-%23C21325?logo=jest)](https://jestjs.io/)
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
- MongoDB 4.4 or higher
- npm (Node Package Manager)

## Usage

```typescript
import { MongoDBLabeler } from "@imigueldiaz/mongodb-labeler";

// Initialize the labeler
const labeler = new MongoDBLabeler({
  uri: "your-mongodb-uri",
  database: "your-database",
  collection: "your-collection",
});

// Start labeling session
await labeler.start();
```

## Configuration

The labeler can be configured with the following options:

```typescript
{
    /** The DID of the labeler account */
    did: string;

    /** The private signing key used for the labeler */
    signingKey: string;

    /** MongoDB connection URI */
    mongoUri: string;

    /** The name of the MongoDB database to use (defaults to 'labeler') */
    databaseName?: string;

    /** The name of the MongoDB collection to use */
    collectionName?: string;

    /** Custom authorization function for label creation */
    auth?: (did: string) => boolean | Promise<boolean>;

    /** Host to bind the server to */
    host?: string;

    /** Port to run the server on (defaults to 4100) */
    port?: number;
}
```

For basic MongoDB usage:

```typescript
import { MongoDBLabeler } from "@imigueldiaz/mongodb-labeler";

const labeler = new MongoDBLabeler({
  mongoUri: "mongodb://localhost:27017",
  databaseName: "my_database",
  collectionName: "my_labels",
});
```

For ATProtocol usage:

```typescript
import { LabelerServer } from "@imigueldiaz/mongodb-labeler";

const server = new LabelerServer({
  did: "your-did",
  signingKey: "your-signing-key",
  mongoUri: "mongodb://localhost:27017",
  databaseName: "atproto_labels",
});

server.start((error, address) => {
  if (error) {
    console.error(error);
  } else {
    console.log(`Labeler server listening on ${address}`);
  }
});
```

## Development

To set up the development environment:

```bash
# Clone the repository
git clone https://github.com/imigueldiaz/mongodb-labeler.git

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

- Ignacio de Miguel Díaz

## Special Thanks

Special thanks to the [@skyware/labeler](https://github.com/skyware-js/labeler) team for their excellent work on the original project that served as the foundation for this tool.
