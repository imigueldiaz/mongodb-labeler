import { default as cbor } from '@atproto/common/lib/cbor';
import { base64ToBytes } from '@atproto/common';
import { AppBskyActorDefs } from '@atproto/api';
import { secp256k1 } from '@atproto/crypto';
import type { FormattedLabel, SignedLabel, UnsignedLabel } from "./types.js";
import { excludeNullish } from "./util.js";

const LABEL_VERSION = 1;

function formatLabelCbor(label: UnsignedLabel): UnsignedLabel {
  return excludeNullish({ ...label, ver: LABEL_VERSION, neg: !!label.neg });
}

export function formatLabel(
  label: UnsignedLabel & { sig?: Uint8Array | { $bytes: string } },
): FormattedLabel {
  const sig = label.sig instanceof Uint8Array
    ? { $bytes: Buffer.from(label.sig).toString('base64') }
    : label.sig;
  if (!sig || !("$bytes" in sig)) {
    throw new Error("Expected sig to be an object with base64 $bytes, got " + sig);
  }
  return excludeNullish({ ...label, ver: LABEL_VERSION, neg: !!label.neg, sig });
}

export function signLabel(label: UnsignedLabel, signingKey: Uint8Array): SignedLabel {
  const toSign = formatLabelCbor(label);
  const bytes = cbor.encode(toSign);
  const sig = secp256k1.sign(bytes, signingKey);
  return { ...toSign, sig };
}

export function labelIsSigned<T extends UnsignedLabel>(label: T): label is T & SignedLabel {
  return "sig" in label && label.sig !== undefined;
}
