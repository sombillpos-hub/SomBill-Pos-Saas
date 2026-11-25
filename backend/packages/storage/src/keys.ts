/** Storage keys are `segment/segment/file.ext` with safe characters only: no `..`, no absolute paths. */
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function assertSafeKey(key: string): void {
  const parts = key.split('/');
  if (parts.length === 0 || parts.length > 8 || parts.some((p) => !SEGMENT.test(p) || p.includes('..'))) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
}
