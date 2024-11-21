import "@atcute/ozone/lexicons";
import { XRPCError } from "@atproto/xrpc";
import fastifyWebsocket from "@fastify/websocket";
import fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { SocketStream } from '@fastify/websocket';
import { MongoDBClient } from "./mongodb.js";
import { parsePrivateKey } from "./util/crypto.js";
import {
    CreateLabelData,
    QueryHandler,
    ProcedureHandler,
    SubscriptionHandler,
    UnsignedLabel,
    SignedLabel,
    SavedLabel,
    FormattedLabel
} from "./util/types.js";
import { frameToBytes } from "./util/util.js";


/**
 * Options for the {@link LabelerServer} class.
 */
export interface LabelerOptions {
    /** The DID of the labeler account. */
    did: string;

    /**
     * The private signing key used for the labeler.
     * If you don't have a key, generate and set one using {@link plcSetupLabeler}.
     */
    signingKey: string;

    /**
     * A function that returns whether a DID is authorized to create labels.
     * By default, only the labeler account is authorized.
     * @param did The DID to check.
     */
    auth?: (did: string) => boolean | Promise<boolean>;

    /**
     * The MongoDB URI to connect to.
     */
    mongoUri: string;

    /**
     * The name of the MongoDB database to use. Defaults to 'labeler'.
     */
    databaseName?: string;

    /**
     * The name of the MongoDB collection to use. Defaults to 'labels'.
     */
    collectionName?: string;

    /**
     * The host address to listen on. 
     * Use undefined to listen on all IPv6 and IPv4 interfaces.
     * Defaults to listening on both ::1 and 127.0.0.1
     */
    host?: string;

    /**
     * The port to listen on.
     * Defaults to 4100.
     */
    port?: number;
}

export class LabelerServer {
    /** The Fastify application instance. */
    app: FastifyInstance;

    /** The MongoDB database instance. */
    private db: MongoDBClient;

    /** The DID of the labeler account. */
    did: string;

    /** A function that returns whether a DID is authorized to create labels. */
    private auth: (did: string) => boolean | Promise<boolean>;

    /** Open WebSocket connections, mapped by request NSID. */
    private connections = new Map<string, Set<SocketStream>>();

    /** The signing key used for the labeler. */
    private signer: any;

    /** The host to listen on. */
    private host?: string;

    /** The port to listen on. */
    private port: number;

    /**
     * Create a labeler server.
     * @param options Configuration options.
     */
    constructor(options: LabelerOptions) {
        this.app = fastify();
        this.db = new MongoDBClient(options.mongoUri, options.databaseName, options.collectionName);
        this.signer = parsePrivateKey(options.signingKey);
        this.did = options.did;
        this.auth = options.auth ?? ((did) => did === this.did);
        this.host = options.host;  
        this.port = options.port ?? 4100;

        void this.app.register(fastifyWebsocket).then(() => {
            this.app.get("/xrpc/com.atproto.label.queryLabels", this.queryLabelsHandler);
            this.app.post("/xrpc/tools.ozone.moderation.emitEvent", this.emitEventHandler);
            this.app.get(
                "/xrpc/com.atproto.label.subscribeLabels",
                { websocket: true },
                this.subscribeLabelsHandler,
            );
            this.app.get("/xrpc/*", this.unknownMethodHandler);
            this.app.setErrorHandler(this.errorHandler);
        });
    }

    /**
     * Start the server.
     * @param callback A callback to run when the server is started.
     */
    async start(callback: (error: Error | null, address: string) => void = () => {}) {
        await this.db.connect();
        void this.app.listen({
            host: this.host,
            port: this.port
        }, callback);
    }

    /**
     * Stop the server.
     * @param callback A callback to run when the server is stopped.
     */
    async close(callback: () => void = () => {}) {
        await this.db.close();
        this.app.close(callback);
    }

    /**
     * Alias for {@link LabelerServer#close}.
     * @param callback A callback to run when the server is stopped.
     */
    stop(callback: () => void = () => {}) {
        this.close(callback);
    }

    /**
     * Create a new label.
     * @param data The label data.
     * @returns The saved label.
     */
    async createLabel(data: CreateLabelData): Promise<SavedLabel> {
        const now = new Date().toISOString();
        const unsignedLabel: UnsignedLabel = {
            ...data,
            src: `did:${this.did.replace(/^did:/, '')}` as const,  
            cts: data.cts ?? now,
            neg: data.neg ?? false
        };
        const signedLabel = await this.signLabel(unsignedLabel);
        return this.db.saveLabel(signedLabel);
    }

    /**
     * Sign a label with the keypair.
     * @param label The unsigned label.
     * @returns The signed label.
     */
    async signLabel(label: UnsignedLabel): Promise<SignedLabel> {
        const bytes = frameToBytes("message", label, "#label");
        const sig = await this.signer.sign(bytes);
        return {
            ...label,
            sig
        };
    }

    /**
     * Format a saved label into a format suitable for emitting to subscribers.
     * @param label The saved label.
     * @returns The formatted label.
     */
    formatLabel(label: SavedLabel): FormattedLabel {
        const { sig, ...rest } = label;
        return {
            ...rest,
            sig: { $bytes: Buffer.from(sig).toString('base64') }  
        };
    }

    /**
     * Create and insert labels into the database, emitting them to subscribers.
     * @param subject The subject of the labels.
     * @param labels The labels to create.
     * @returns The created labels.
     */
    createLabels(
        subject: { uri: string; cid?: string | undefined },
        labels: { create?: Array<string>; negate?: Array<string> },
    ): Promise<Array<SavedLabel>> {
        return Promise.all([
            ...(labels.create || []).map((val) =>
                this.createLabel({ ...subject, val, neg: false })
            ),
            ...(labels.negate || []).map((val) =>
                this.createLabel({ ...subject, val, neg: true })
            ),
        ]);
    }



    /**
     * Add a WebSocket connection to the list of subscribers for a given lexicon.
     * @param nsid The NSID of the lexicon to subscribe to.
     * @param ws The WebSocket connection to add.
     */
    private addSubscription(nsid: string, ws: SocketStream) {
        let connections = this.connections.get(nsid);
        if (!connections) {
            connections = new Set();
            this.connections.set(nsid, connections);
        }
        connections.add(ws);
    }

    /**
     * Remove a WebSocket connection from the list of subscribers for a given lexicon.
     * @param nsid The NSID of the lexicon to unsubscribe from.
     * @param ws The WebSocket connection to remove.
     */
    private removeSubscription(nsid: string, ws: SocketStream) {
        const connections = this.connections.get(nsid);
        if (connections) {
            connections.delete(ws);
            if (connections.size === 0) {
                this.connections.delete(nsid);
            }
        }
    }

    /**
     * Handles querying labels based on URI, cursor, and limit parameters.
     * Retrieves labels from the database and sends them as a response, 
     * along with the next cursor for pagination.
     * 
     * @param req - The incoming request containing query parameters.
     * @param res - The response object to send the results.
     */
    queryLabelsHandler: QueryHandler<{
        uris?: string[];
        cursor?: string;
        limit?: string;
    }> = async (req, res) => {
        const { uris, cursor = "0", limit = "50" } = req.query;
        const labels = await this.db.findLabels(
            { uri: uris ? { $in: uris } : undefined },
            {
                sort: { id: 1 },
                skip: parseInt(cursor, 10),
                limit: parseInt(limit, 10)
            }
        );

        const nextCursor = labels[labels.length - 1]?.id?.toString(10) || "0";
        await res.send({ cursor: nextCursor, labels: labels.map((l: SavedLabel) => this.formatLabel(l)) });
    };

    /**
     * Subscribes to the labels lexicon, sending the subscriber any labels which
     * have been created since the given cursor. The cursor is a monotonically
     * increasing integer which can be used to fetch the next set of labels.
     *
     * If the cursor is not provided, the request is treated as a subscription
     * to the lexicon, and the subscriber will receive all new labels created
     * after the subscription was established.
     *
     * @param ws The WebSocket connection to send the labels to.
     * @param req The incoming request containing the query parameters.
     */
    subscribeLabelsHandler: SubscriptionHandler<{ cursor?: string }> = async (ws: SocketStream, req: FastifyRequest<{
        Querystring: {
            cursor?: string;
        }
    }>) => {
        const cursor = parseInt(req.query.cursor ?? "NaN", 10);

        if (!Number.isNaN(cursor)) {
            try {
                const labels = await this.db.getLabelsAfterCursor(cursor, 1000);
                for (const label of labels) {
                    const { id: seq, ...labelData } = label;
                    const bytes = frameToBytes(
                        "message",
                        { seq, labels: [this.formatLabel({ ...labelData, id: seq })] },
                        "#labels"
                    );
                    ws.socket.send(bytes);
                }
            } catch (e) {
                console.error(e);
                const errorBytes = frameToBytes("error", "An unknown error occurred");
                ws.socket.send(errorBytes);
                ws.socket.terminate();
                return;
            }
        }

        this.addSubscription("com.atproto.label.subscribeLabels", ws);
        ws.on("close", () => {
            this.removeSubscription("com.atproto.label.subscribeLabels", ws);
        });
    };

    /**
     * @procedures
     * @summary Emit a label event on a DID, allowing it to be indexed by the labeler.
     * @description
     * Emits an event that the labeler can observe to update its index of labels.
     * The event should contain the `did` of the subject, the `type` of the event,
     * the `createdBy` of the event, and optionally `subjectBlobCids` which are
     * the blob CIDs of blobs that are referenced by the event.
     * The event can also contain `labels` which is an object with a `create` and/or
     * `negate` key. The `create` key maps to an array of labels to be created,
     * and the `negate` key maps to an array of labels to be negated.
     * @returns {createdAt: string}
     * @example
     */ 
    emitEventHandler: ProcedureHandler<{
        event: {
            type: string;
            subject: { did: string; };
            subjectBlobCids?: string[];
            createdBy: string;
            labels?: { create?: CreateLabelData[]; negate?: CreateLabelData[]; };
        };
    }> = async (req, res): Promise<{ createdAt: string }> => {
        const { event } = req.body;
        const { labels = {} } = event;
        const { create: _create = [], negate: _negate = [] } = labels;

        try {
            // TODO: Implement label creation and negation
            const createdAt = new Date().toISOString();
            await res.send({ createdAt });
            return { createdAt };
        } catch (error: unknown) {
            if (error instanceof XRPCError) {
                throw error;
            }
            throw new XRPCError(500, "Internal Server Error");
        }
    };

    /**
     * @queries
     * @summary Handles unknown or unsupported method requests.
     * @description
     * Returns a 501 Method Not Implemented response.
     * @returns {string} "Method Not Implemented"
     */
    unknownMethodHandler: QueryHandler = (_req: FastifyRequest, res: any): Promise<void> =>
        Promise.resolve(res.status(501).send("Method Not Implemented"));

    /**
     * Handles any errors that may occur while handling a request.
     *
     * If the error is an instance of `XRPCError`, it will be sent as a response with the same status code and message.
     * Otherwise, a 500 Internal Server Error response will be sent.
     * @param err - The error that was encountered.
     * @param _req - The request that caused the error.
     * @param res - The response to be sent.
     */
    errorHandler: typeof this.app.errorHandler = (err: XRPCError | Error, _req: FastifyRequest, res: any): Promise<void> => {
        if (err instanceof XRPCError) {
            return Promise.resolve(res.status(err.status).send(err.message));
        } else {
            return Promise.resolve(res.status(500).send("Internal Server Error"));
        }
    };
}
