
export interface LabelDefinition {
  identifier: string;
  value: string;
  description?: string;
  negation?: boolean;
}

export interface SavedLabel {
  src: string;
  uri: string;
  val: string;
  cts: string;
  neg?: boolean;
  sig: ArrayBuffer;
  id: number;
}

export interface UnsignedLabel {
  src?: string;
  uri: string;
  cid?: string;
  val: string;
  neg?: boolean;
  cts?: string;
  exp?: string;
  ver?: number;
}

export interface SignedLabel extends UnsignedLabel {
  sig: Uint8Array;
}

export interface FormattedLabel extends UnsignedLabel {
  sig?: { $bytes: string };
}

export interface LoginCredentials {
  pds?: string;
  identifier: string;
  password: string;
  code?: string;
}

export interface LabelerConfig {
  did: string;
  password: string;
  pds?: string;
  plcToken?: string;
}
