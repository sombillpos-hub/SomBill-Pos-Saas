import { Globe2, MapPin } from 'lucide-react';
import { useHq, ALL } from '../features/HqContext';

/** Filters every page (revenue, registers, audit, …) to one branch or the whole group. */
export function BranchSwitcher() {
  const { branches, scope, setScope } = useHq();
  return (
    <label className="sa-switcher">
      {scope === ALL ? <Globe2 className="h-4 w-4" aria-hidden /> : <MapPin className="h-4 w-4" aria-hidden />}
      <span className="sr-only">Branch</span>
      <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Branch scope">
        <option value={ALL}>All branches (group)</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
