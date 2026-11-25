export const FILE_PURPOSES = ['MENU_IMAGE', 'BRANDING', 'EXPENSE_ATTACHMENT', 'DOCUMENT'] as const;
export type FilePurpose = (typeof FILE_PURPOSES)[number];

/** File types accepted per purpose (by detected content). */
export const ALLOWED_TYPES: Record<FilePurpose, readonly string[]> = {
  MENU_IMAGE: ['image/png', 'image/jpeg', 'image/webp'],
  BRANDING: ['image/png', 'image/jpeg', 'image/webp'],
  EXPENSE_ATTACHMENT: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
  DOCUMENT: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
};

/** An upload as received from the HTTP layer. */
export interface IncomingFile {
  originalName: string;
  buffer: Uint8Array;
}
