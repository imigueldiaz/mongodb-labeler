declare global {
  var mockFindLabelsError: boolean;
  var mockLabels: Array<{
    src: string;
    uri: string;
    val: string;
    cts: string;
    neg?: boolean;
  }> | undefined;
}

export {};
