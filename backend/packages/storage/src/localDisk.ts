import { mkdir, readFile, rm, stat, writeFile, rename, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { assertSafeKey } from './keys.js';
import type { StorageProvider, StoredObject } from './index.js';

/**
 * Stores objects as files under `root`. Writes go to a temporary file first and are renamed into place, so a
 * reader never sees a half-written file. Suitable for development and single-host deployments (mount `root` as a
 * persistent volume); use an object store when the API runs on several hosts.
 */
export class LocalDiskStorage implements StorageProvider {
  readonly name = 'local-disk';
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  private pathOf(key: string): string {
    assertSafeKey(key);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error(`Storage key escapes the root: ${key}`);
    return full;
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<StoredObject> {
    const full = this.pathOf(key);
    await mkdir(path.dirname(full), { recursive: true });
    const tmp = `${full}.${randomUUID()}.tmp`;
    await writeFile(tmp, body, { flag: 'wx' });
    await rename(tmp, full);
    return { key, contentType, size: body.byteLength };
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return await readFile(this.pathOf(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }

  async check(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await access(this.root, constants.W_OK);
    await stat(this.root);
  }
}
