import { useState } from 'react';
import { Bluetooth, Cable, Monitor, Printer, Usb, Wifi } from 'lucide-react';
import { cn } from '@sombill/shared-utils/cn';
import { useThermalPrinter } from '../hooks/useThermalPrinter';
import { PrinterSetupModal } from './PrinterSetupModal';

const LABELS = {
  usb: { label: 'USB Printer', Icon: Usb },
  serial: { label: 'Serial Printer', Icon: Cable },
  bluetooth: { label: 'BT Printer', Icon: Bluetooth },
  network: { label: 'LAN Printer', Icon: Wifi },
  browser: { label: 'Print', Icon: Monitor },
} as const;

/** Compact status pill in the Cashier topbar; opens the universal Thermal Printer Setup modal. */
export function PrinterPill() {
  const [open, setOpen] = useState(false);
  const snap = useThermalPrinter();
  const isHw = snap.settings.transport !== 'browser';
  const { label, Icon } = LABELS[snap.settings.transport];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Thermal printer: ${snap.deviceName ?? 'Disconnected'}`}
        title={snap.deviceName ? `${snap.deviceName} (${snap.settings.paperWidth}mm)` : 'Configure thermal printer'}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors',
          isHw && snap.connected
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            : isHw && !snap.connected
              ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
              : 'border-slate-200 bg-white/80 text-slate-700 hover:bg-slate-100',
        )}
      >
        {isHw ? <Icon className="h-3.5 w-3.5" /> : <Printer className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">
          {isHw ? (snap.connected ? label : `${label} (off)`) : `${snap.settings.paperWidth}mm`}
        </span>
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            isHw && snap.connected ? 'bg-emerald-500' : isHw ? 'bg-amber-500' : 'bg-slate-400',
          )}
        />
      </button>
      <PrinterSetupModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
