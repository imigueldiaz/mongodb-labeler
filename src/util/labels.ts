import { Secp256k1Keypair } from "@atproto/crypto";
import type { FormattedLabel, SignedLabel, UnsignedLabel } from "./types.js";
import { excludeNullish } from "./util.js";

const LABEL_VERSION = 1 as const;

function formatLabelCbor(label: UnsignedLabel): UnsignedLabel {
  return excludeNullish({ ...label, ver: LABEL_VERSION, neg: !!label.neg });
}

export function formatLabel(
  label: UnsignedLabel & { sig?: Uint8Array | { $bytes: string } },
): FormattedLabel {
  const sig = label.sig instanceof Uint8Array
    ? { $bytes: Buffer.from(label.sig).toString("base64") }
    : label.sig;
  if (!sig || !("$bytes" in sig)) {
    throw new Error(`Expected sig to be an object with base64 $bytes, got ${String(sig)}`);
  }
  return excludeNullish({ ...label, ver: LABEL_VERSION, neg: !!label.neg, sig });
}

export async function signLabel(
  label: UnsignedLabel,
  signingKey: Uint8Array,
): Promise<SignedLabel> {
  const toSign = formatLabelCbor(label);
  const keypair = new Secp256k1Keypair(signingKey, false);
  const sig = await keypair.sign(Buffer.from(JSON.stringify(toSign)));
  return { ...toSign, sig };
}

export function labelIsSigned<T extends UnsignedLabel>(label: T): label is T & SignedLabel {
  return "sig" in label && label.sig !== undefined;
}

export function generateExpiration(daysFromNow: number = 365): string {
  const exp = new Date();
  exp.setDate(exp.getDate() + daysFromNow);
  return exp.toISOString();
}
