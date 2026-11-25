import { useRef, useState } from 'react';
import { Check, ImagePlus, Link2, Loader2, Trash2, Upload } from 'lucide-react';
import { uploadFile } from '@sombill/api-client/storage';
import { friendlyError } from '@sombill/api-client/supabase';
import { cn } from '@sombill/shared-utils/cn';

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  restaurantId: string;
  bucket: 'menu-images' | 'branding';
  folder: string;
  label?: string;
}

const VALID_URL = /^(https?:\/\/|\/|data:image\/)/i;

export function ImageUpload({ value, onChange, restaurantId, bucket, folder, label = 'Image' }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'file' | 'url'>('file');
  const [urlDraft, setUrlDraft] = useState(value ?? '');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [imgBroken, setImgBroken] = useState(false);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setErr(null);
    setImgBroken(false);
    try {
      const uploaded = await uploadFile(bucket, restaurantId, folder, f);
      onChange(uploaded);
      setUrlDraft(uploaded);
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const applyUrl = () => {
    const trimmed = urlDraft.trim();
    if (!trimmed) {
      onChange(null);
      setErr(null);
      setImgBroken(false);
      return;
    }
    if (!VALID_URL.test(trimmed)) {
      setErr('Enter a valid image URL starting with https:// or http://');
      return;
    }
    setErr(null);
    setImgBroken(false);
    onChange(trimmed);
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="label mb-0">{label}</span>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('file');
              setErr(null);
            }}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-0.5 transition',
              mode === 'file' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <Upload className="h-3 w-3" /> File
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('url');
              setUrlDraft(value && !value.startsWith('data:') ? value : '');
              setErr(null);
            }}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-0.5 transition',
              mode === 'url' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <Link2 className="h-3 w-3" /> URL
          </button>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void pick(e.dataTransfer.files?.[0]);
          }}
          onClick={() => mode === 'file' && !busy && input.current?.click()}
          className={cn(
            'flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed bg-slate-50 transition',
            dragging ? 'border-orange-500 bg-orange-50' : 'border-slate-300',
            mode === 'file' && !busy && 'cursor-pointer hover:border-orange-400',
          )}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
          ) : value && !imgBroken ? (
            <img
              src={value}
              alt=""
              className="h-full w-full object-cover"
              onError={() => {
                setImgBroken(true);
                setErr('Could not load image from this URL.');
              }}
            />
          ) : (
            <ImagePlus className="h-6 w-6 text-slate-300" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {mode === 'file' ? (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                className="text-left text-sm font-semibold text-brand-red hover:underline"
                onClick={() => input.current?.click()}
                disabled={busy}
              >
                {value ? 'Replace image' : 'Upload image'}
              </button>
              <span className="text-xs text-slate-400">Click or drag &amp; drop · PNG, JPG, WEBP (max 2 MB)</span>
              {value && (
                <button
                  type="button"
                  className="inline-flex w-fit items-center gap-1 text-left text-xs text-slate-500 hover:text-red-600"
                  onClick={() => {
                    onChange(null);
                    setUrlDraft('');
                    setImgBroken(false);
                  }}
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                <input
                  type="url"
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      applyUrl();
                    }
                  }}
                  placeholder="https://example.com/dish.jpg"
                  className="input h-9 flex-1 text-xs"
                  aria-label={`${label} URL`}
                />
                <button
                  type="button"
                  onClick={applyUrl}
                  className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl bg-gradient-to-r from-[#dc2626] to-[#f97316] px-3 text-xs font-bold text-white shadow-sm hover:brightness-110"
                >
                  <Check className="h-3.5 w-3.5" /> Apply
                </button>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Paste any direct image link</span>
                {value && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-slate-500 hover:text-red-600"
                    onClick={() => {
                      onChange(null);
                      setUrlDraft('');
                      setImgBroken(false);
                    }}
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
        aria-label={label}
      />
      {err && (
        <p role="alert" className="mt-1.5 text-xs text-red-600">
          {err}
        </p>
      )}
    </div>
  );
}
