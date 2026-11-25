import { useState } from 'react';
import { Radio } from 'lucide-react';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Input, Select, Textarea } from '@sombill/shared-ui/ui/Field';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { friendlyError } from '@sombill/api-client/supabase';
import type { AppRole } from '@sombill/shared-types/types';
import { broadcast } from '../services/hq';
import { ALL, useHq } from '../features/HqContext';

const ROLES: { id: AppRole; label: string }[] = [
  { id: 'manager', label: 'Managers' },
  { id: 'cashier', label: 'Cashiers' },
  { id: 'waiter', label: 'Waiters' },
  { id: 'kitchen', label: 'Kitchen' },
];

/** Sends a notification to staff of one branch or all branches. It appears in each person's notification list. */
export function BroadcastModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { org, branches, scope } = useHq();
  const toast = useToast();
  const [branch, setBranch] = useState(scope === ALL ? ALL : scope);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setError(null);
    if (title.trim().length < 2) return setError('Write a short title.');
    setBusy(true);
    try {
      const n = await broadcast(org.id, branch === ALL ? null : branch, title.trim(), body.trim(), roles);
      toast.success(
        n === 0 ? 'Sent, but nobody matched those filters.' : `Message sent to ${n} staff member${n === 1 ? '' : 's'}.`,
      );
      setTitle('');
      setBody('');
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Broadcast to staff"
      description="Sent as a notification to everyone selected. It is also recorded in each branch's audit log."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={<Radio className="h-4 w-4" />} loading={busy} onClick={send}>
            Send broadcast
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select label="Send to" value={branch} onChange={(e) => setBranch(e.target.value)}>
          <option value={ALL}>All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        <fieldset>
          <legend className="label">Roles (none selected = everyone)</legend>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <label
                key={r.id}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={roles.includes(r.id)}
                  onChange={(e) =>
                    setRoles((cur) => (e.target.checked ? [...cur, r.id] : cur.filter((x) => x !== r.id)))
                  }
                />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        <Input
          label="Title"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Staff meeting at 15:00"
          required
        />
        <Textarea label="Message (optional)" value={body} rows={3} onChange={(e) => setBody(e.target.value)} />
        {error && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
