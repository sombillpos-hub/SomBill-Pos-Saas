import { RANGE_LABEL } from '../features/lib/range';
import type { RangeKey } from '../features/types';

const KEYS: RangeKey[] = ['today', 'week', 'mtd', 'year'];

export function RangeTabs({ value, onChange }: { value: RangeKey; onChange: (k: RangeKey) => void }) {
  return (
    <div className="sa-seg no-print" role="group" aria-label="Time range">
      {KEYS.map((k) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}>
          {RANGE_LABEL[k]}
        </button>
      ))}
    </div>
  );
}
