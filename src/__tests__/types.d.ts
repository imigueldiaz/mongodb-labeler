declare global {
	const mockFindLabelsError: boolean;
	const mockLabels:
		| Array<{ src: string; uri: string; val: string; cts: string; neg?: boolean }>
		| undefined;
}

export {};
