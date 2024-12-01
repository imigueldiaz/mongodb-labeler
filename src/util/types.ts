import { At, ComAtprotoLabelDefs } from "@atcute/client/lib/lexicons";
import type { WebsocketHandler } from "@fastify/websocket";
import type {
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
  RequestGenericInterface,
  RouteGenericInterface,
  RouteHandlerMethod,
} from "fastify";
import { Binary, ObjectId } from "mongodb";

type NullishKeys<T> = {
  [K in keyof T]: null extends T[K] ? K : undefined extends T[K] ? K : never;
}[keyof T];
type NonNullishKeys<T> = Exclude<keyof T, NullishKeys<T>>;
export type NonNullishPartial<T> =
  & { [K in NullishKeys<T>]+?: Exclude<T[K], null | undefined> }
  & { [K in NonNullishKeys<T>]-?: T[K] };

/**
 * Data required to create a label.
 */
export type UnsignedLabel = Omit<ComAtprotoLabelDefs.Label, "sig"> & { ver: 1 };

/**
 * Data required to create a label.
 */
export interface CreateLabelData {
  /** The label schema version. Current version is always 1. */
  ver: number;
  /** The label value. */
  val: string;
  /** 
   * The subject of the label. 
   * - For labeling an account, this should be a string beginning with `did:`. CID must not be provided for DID URIs.
   * - For labeling specific content, this should be a string beginning with `at://`. It's recommended to provide a CID 
   *   for content-specific labels to reference a specific version.
   */
  uri: string;
  /** 
   * The CID specifying the version of the content to label. 
   * - Only applicable for `at://` URIs
   * - Must not be provided for `did:` URIs
   * - Recommended to include for content-specific labels to reference a specific version
   */
  cid?: string;
  /** Whether this label is negating a previous instance of this label applied to the same subject. */
  neg?: boolean;
  /** The DID of the actor who created this label, if different from the labeler. Must start with 'did:'. */
  src?: `did:${string}`;
  /** The creation date of the label. Must be in ISO 8601 format. */
  cts?: string;
  /** The expiration date of the label, if any. Must be in ISO 8601 format. */
  exp?: string;
}

export type SignedLabel = UnsignedLabel & { sig: Uint8Array };
export type FormattedLabel = UnsignedLabel & { sig?: At.Bytes };
export type SavedLabel = UnsignedLabel & { sig: ArrayBuffer; id: number };
export type MongoSavedLabel = Omit<SavedLabel, "sig"> & {
  id: number & ObjectId;
  sig: Binary;
};

export type QueryHandler<
  T extends RouteGenericInterface["Querystring"] = RouteGenericInterface["Querystring"],
> = RouteHandlerMethod<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  { Querystring: T }
>;
export type ProcedureHandler<
  T extends RouteGenericInterface["Body"] = RouteGenericInterface["Body"],
> = RouteHandlerMethod<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  { Body: T }
>;
export type SubscriptionHandler<
  T extends RequestGenericInterface["Querystring"] = RequestGenericInterface["Querystring"],
> // eslint-disable-next-line @typescript-eslint/naming-convention
 = WebsocketHandler<RawServerDefault, RawRequestDefaultExpression, { Querystring: T }>;
