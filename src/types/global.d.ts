declare global {
	let mockFindLabelsError: boolean;
	let mockLabels:
		| Array<{ src: string; uri: string; val: string; cts: string; neg?: boolean }>
		| undefined;
}

export {};
