import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertSafeKey, LocalDiskStorage, sniffFileType } from '../src/index.js';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

describe('local disk storage', () => {
  it('writes, reads and removes objects', async () => {
    const s = new LocalDiskStorage(await mkdtemp(path.join(tmpdir(), 'sb-storage-')));
    await s.check();
    expect(await s.put('org/menu/a.png', PNG, 'image/png')).toEqual({
      key: 'org/menu/a.png',
      contentType: 'image/png',
      size: 10,
    });
    expect(await s.get('org/menu/a.png')).toEqual(Buffer.from(PNG));
    await s.remove('org/menu/a.png');
    expect(await s.get('org/menu/a.png')).toBeNull();
    await s.remove('org/menu/a.png');
  });

  it('rejects keys that could escape the root', () => {
    for (const k of ['../x', 'a/../../b', '/etc/passwd', 'a//b', '.hidden', 'a\\b']) {
      expect(() => assertSafeKey(k)).toThrow();
    }
    expect(() => assertSafeKey('0f/menu_image/abc-1.png')).not.toThrow();
  });
});

describe('file type sniffing', () => {
  it('detects by content, not by name', () => {
    expect(sniffFileType(PNG)?.mime).toBe('image/png');
    expect(sniffFileType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe('jpg');
    expect(sniffFileType(new TextEncoder().encode('%PDF-1.7'))?.mime).toBe('application/pdf');
    expect(sniffFileType(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull();
  });
});
