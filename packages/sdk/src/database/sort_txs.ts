export function sortTxs<
  T extends {
    createdTs: number;
    finalizedTs: number;
  }
>(txs: T[]): T[] {
  return [
    ...txs
      .filter((tx) => tx.finalizedTs === 0)
      .sort((a, b) => (a.createdTs < b.createdTs ? 1 : -1)),
    ...txs
      .filter((tx) => tx.finalizedTs > 0)
      .sort((a, b) =>
        a.finalizedTs !== b.finalizedTs ? 0 : a.createdTs < b.createdTs ? 1 : -1
      ),
  ];
}
