export function isPasteLikeInsertion(previous: string, next: string): boolean {
  if (next.length > previous.length + 1) return true;
  if (next.length === previous.length) return false;

  return !next.startsWith(previous) && !previous.startsWith(next);
}
