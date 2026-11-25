import { supabase } from './supabase';

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const ATTACHMENT_TYPES = [...IMAGE_TYPES, 'application/pdf'];
const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'image/svg+xml': 'svg',
};

export function validateFile(file: File, types: string[], maxBytes: number): string | null {
  if (!types.includes(file.type)) return `Unsupported file type. Allowed: ${types.map((t) => EXT[t] ?? t).join(', ')}`;
  if (file.size > maxBytes) return `File is too large (max ${(maxBytes / 1048576).toFixed(0)} MB)`;
  return null;
}

/** Uploads under `<restaurantId>/<folder>/<uuid>.<ext>` so storage RLS can scope by restaurant. */
export async function uploadFile(
  bucket: 'menu-images' | 'branding' | 'expense-attachments',
  restaurantId: string,
  folder: string,
  file: File,
): Promise<string> {
  const types = bucket === 'expense-attachments' ? ATTACHMENT_TYPES : IMAGE_TYPES;
  const maxBytes = bucket === 'expense-attachments' ? 5 * 1048576 : 2 * 1048576;
  const problem = validateFile(file, types, maxBytes);
  if (problem) throw new Error(problem);
  const path = `${restaurantId}/${folder}/${crypto.randomUUID()}.${EXT[file.type]}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' });
  if (error) throw new Error(error.message);
  if (bucket === 'expense-attachments') return path;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function signedAttachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('expense-attachments').createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
