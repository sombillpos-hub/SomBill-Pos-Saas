/**
 * Detects the real file type from its first bytes. Uploads are accepted by detected type, never by the
 * client-supplied Content-Type or file extension. SVG is deliberately not supported (it can carry scripts).
 */
export type DetectedType = { mime: string; ext: string };

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);

export function sniffFileType(b: Uint8Array): DetectedType | null {
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: 'image/png', ext: 'png' };
  if (startsWith(b, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: 'jpg' };
  if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8))
    return { mime: 'image/webp', ext: 'webp' };
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: 'application/pdf', ext: 'pdf' };
  return null;
}
