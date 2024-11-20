<p align="center">
	<img src="https://github.com/skyware-js/.github/blob/main/assets/logo-dark.png?raw=true" height="72">
</p>
<h1 align="center">@skyware/labeler</h1>

A lightweight alternative to Ozone for operating an atproto labeler.

[Documentation](https://skyware.js.org/docs/firehose)

## CLI

The `@skyware/labeler` package also comes with a CLI for setting up and managing a labeler.

```sh
$ npx @skyware/labeler
Usage: npx @skyware/labeler [command]
Commands:
  setup - Initialize an account as a labeler.
  clear - Restore a labeler account to normal.
  label add - Add new label declarations to a labeler account.
  label delete - Remove label declarations from a labeler account.
```

For a full guide to setting up a labeler, see [Getting Started](https://skyware.js.org/guides/labeler/introduction/getting-started).

## Installation

```sh
npm install @skyware/labeler
```

## Example Usage

This library requires an existing labeler declaration. To get set up, refer to the [Getting Started](https://skyware.js.org/guides/labeler/introduction/getting-started) guide.

```js
import { LabelerServer } from "@skyware/labeler";

const server = new LabelerServer({ did: "···", signingKey: "···" });

server.start(14831, (error, address) => {
    if (error) {
        console.error(error);
    } else {
        console.log(`Labeler server listening on ${address}`);
    }
});
```

## MongoDB Configuration

This fork of the labeler uses MongoDB instead of SQLite. To use it, you'll need:

1. A MongoDB database (can be local or cloud-hosted)
2. The MongoDB connection URI

### Setup

1. Install dependencies:
```bash
npm install
```

2. Configure the labeler with your MongoDB URI:
```typescript
import { LabelerServer } from '@skyware/labeler';

const server = new LabelerServer({
    did: 'your-did',
    signingKey: 'your-signing-key',
    mongoUri: 'mongodb://your-mongodb-uri'
});

await server.start(3000);
```

The MongoDB URI should be in the format: `mongodb://[username:password@]host[:port]/database`

### Environment Variables

It's recommended to use environment variables for sensitive information:

```typescript
const server = new LabelerServer({
    did: process.env.LABELER_DID,
    signingKey: process.env.LABELER_SIGNING_KEY,
    mongoUri: process.env.MONGODB_URI
});
```