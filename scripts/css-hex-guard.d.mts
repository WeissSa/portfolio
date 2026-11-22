export function stripCssComments(css: string): string;
export function findRawHexOutsideRoot(css: string): string[];
export function findNonTokenRootHex(
  css: string,
  allowedValues: readonly string[],
): string[];
