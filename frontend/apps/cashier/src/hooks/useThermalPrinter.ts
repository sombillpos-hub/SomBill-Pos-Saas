import { useEffect, useSyncExternalStore } from 'react';
import { thermalPrinter, type PrinterSnapshot } from '../services/thermalPrinter';

let reconnectAttempted = false;

export function useThermalPrinter(): PrinterSnapshot {
  const snap = useSyncExternalStore(thermalPrinter.subscribe, thermalPrinter.getSnapshot, thermalPrinter.getSnapshot);
  useEffect(() => {
    if (reconnectAttempted) return;
    reconnectAttempted = true;
    void thermalPrinter.tryAutoReconnect();
  }, []);
  return snap;
}
