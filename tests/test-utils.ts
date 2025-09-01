let portCounter = 5000;

export function getUniquePort(): number {
  return ++portCounter;
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}