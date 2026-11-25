/**
 * File storage port and its implementations. Modules depend on `StorageProvider` only, so the local-disk provider
 * (development, single host) can be swapped for an object store (S3, R2, GCS) without touching them.
 */
export interface StoredObject {
  key: string;
  contentType: string;
  size: number;
}

export interface StorageProvider {
  readonly name: string;
  put(key: string, body: Uint8Array, contentType: string): Promise<StoredObject>;
  /** Returns null when the object does not exist. */
  get(key: string): Promise<Uint8Array | null>;
  /** Removing a missing object is not an error. */
  remove(key: string): Promise<void>;
  /** Readiness probe (used by /health/ready). */
  check(): Promise<void>;
}

export * from './keys.js';
export * from './localDisk.js';
export * from './sniff.js';
