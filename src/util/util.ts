import { cborEncode } from "@atproto/common";
import { NonNullishPartial } from "./types.js";

export function excludeNullish<T extends Record<PropertyKey, unknown>>(
	obj: T,
): NonNullishPartial<T> {
	return Object.entries(obj).reduce<Record<string, unknown>>((acc, [key, value]) => {
		if (value != null) {
			acc[key] = value;
		}
		return acc;
	}, {}) as never;
}

export function frameToBytes(op: string, body: unknown, tag?: string): Uint8Array {
	const frame = { op, body, ...(tag && { tag }) };
	return cborEncode(frame);
}
