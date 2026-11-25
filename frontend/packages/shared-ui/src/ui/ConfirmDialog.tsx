import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Textarea } from './Field';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  requireReason?: boolean;
  onConfirm: (reason: string) => Promise<void> | void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  requireReason,
  onConfirm,
  onClose,
}: Props) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const tooShort = requireReason && reason.trim().length < 3;

  const close = () => {
    setReason('');
    setErr(null);
    onClose();
  };
  const go = async () => {
    if (tooShort) {
      setErr('Please enter a reason (at least 3 characters).');
      return;
    }
    setBusy(true);
    try {
      await onConfirm(reason.trim());
      setReason('');
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? 'primary' : 'navy'} onClick={go} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${danger ? 'bg-red-50 text-brand-red' : 'bg-orange-50 text-brand-orange'}`}
        >
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="text-sm text-slate-600">{message}</p>
      </div>
      {requireReason && (
        <Textarea
          wrapClassName="mt-4"
          label="Reason"
          name="confirm-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
        />
      )}
      {err && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">
          {err}
        </p>
      )}
    </Modal>
  );
}
