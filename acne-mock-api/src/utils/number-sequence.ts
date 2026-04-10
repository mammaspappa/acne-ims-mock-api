const sequences = new Map<string, number>();

export function nextSequence(prefix: string, digits: number = 5): string {
  const current = sequences.get(prefix) || 0;
  const next = current + 1;
  sequences.set(prefix, next);
  return `${prefix}-${String(next).padStart(digits, '0')}`;
}

export function setSequence(prefix: string, value: number): void {
  sequences.set(prefix, value);
}

export function resetSequences(): void {
  sequences.clear();
}

export function getSequenceValue(prefix: string): number {
  return sequences.get(prefix) || 0;
}
