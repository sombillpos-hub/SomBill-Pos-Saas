import { useState } from 'react';
import {
  Bluetooth,
  Cable,
  CheckCircle2,
  Coins,
  Monitor,
  Printer,
  Unplug,
  Usb,
  Wifi,
  AlertCircle,
} from 'lucide-react';
import { useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Badge } from '@sombill/shared-ui/ui/Feedback';
import { Input, Select } from '@sombill/shared-ui/ui/Field';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { cn } from '@sombill/shared-utils/cn';
import { useThermalPrinter } from '../hooks/useThermalPrinter';
import {
  thermalPrinter,
  type NetworkProtocol,
  type PrinterTransport,
  type SerialBaudRate,
} from '../services/thermalPrinter';
import type { CutMode, PaperWidthMm } from '../services/escpos';

const BAUD_RATES: SerialBaudRate[] = [9600, 19200, 38400, 57600, 115200];

const TRANSPORT_CARDS: Array<{
  id: PrinterTransport;
  title: string;
  subtitle: string;
  icon: typeof Usb;
}> = [
  { id: 'usb', title: 'USB Direct', subtitle: 'Epson, Star, Xprinter, Rongta, Sunmi', icon: Usb },
  { id: 'serial', title: 'Serial / COM', subtitle: 'USB-Serial, RS-232, BT-SPP', icon: Cable },
  { id: 'bluetooth', title: 'Bluetooth', subtitle: 'Portable 58mm / 80mm BLE', icon: Bluetooth },
  { id: 'network', title: 'LAN / Wi-Fi', subtitle: 'Ethernet IP :9100 or ePOS', icon: Wifi },
  { id: 'browser', title: 'OS Driver', subtitle: 'Any installed system printer', icon: Monitor },
];

export function PrinterSetupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const r = useRestaurant();
  const toast = useToast();
  const snap = useThermalPrinter();
  const [selectedTab, setSelectedTab] = useState<PrinterTransport>(snap.settings.transport);
  const [baud, setBaud] = useState<SerialBaudRate>(snap.settings.serialBaudRate);
  const [netProtocol, setNetProtocol] = useState<NetworkProtocol>(snap.settings.networkProtocol);
  const [netHost, setNetHost] = useState(snap.settings.networkHost);
  const [netPort, setNetPort] = useState(String(snap.settings.networkPort));
  const [bridgeUrl, setBridgeUrl] = useState(snap.settings.bridgeUrl);

  const run = async (fn: () => Promise<void>, okMsg: string) => {
    try {
      await fn();
      toast.success(okMsg);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // User cancelling the browser device picker is not an error toast
      if (/no device selected|no port selected|cancelled|canceled/i.test(msg)) return;
      toast.error(msg);
    }
  };

  const isHardware = snap.settings.transport !== 'browser';
  const canHardwareTest = isHardware && snap.connected;

  return (
    <Modal open={open} onClose={onClose} title="Thermal Printer Setup" size="lg">
      <div className="space-y-5">
        {/* Live status banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                snap.connected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
              )}
            >
              <Printer className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  {snap.deviceName ?? 'No hardware printer connected'}
                </p>
                <Badge tone={snap.connected ? 'green' : 'yellow'}>
                  {snap.connected ? (isHardware ? 'Direct Hardware Ready' : 'System Driver') : 'Disconnected'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                {snap.settings.paperWidth}mm roll · Cut: {snap.settings.cut} · Copies: {snap.settings.copies}×
                {snap.settings.openDrawerOnCash ? ' · Auto cash drawer' : ''}
              </p>
            </div>
          </div>
          {isHardware && snap.connected && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Unplug className="h-4 w-4" />}
              onClick={() => void run(() => thermalPrinter.disconnect(), 'Printer disconnected.')}
            >
              Disconnect
            </Button>
          )}
        </div>

        {snap.lastError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{snap.lastError}</span>
          </div>
        )}

        {/* Transport selector */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            1. Choose Connection Type
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {TRANSPORT_CARDS.map((card) => {
              const Icon = card.icon;
              const active = selectedTab === card.id;
              const activeConnected = snap.settings.transport === card.id && snap.connected;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setSelectedTab(card.id)}
                  className={cn(
                    'flex flex-col items-start rounded-xl border p-3 text-left transition-colors',
                    active
                      ? 'border-orange-500 bg-orange-50/70 ring-1 ring-orange-500'
                      : 'border-slate-200 bg-white hover:bg-slate-50',
                  )}
                >
                  <div className="mb-1.5 flex w-full items-center justify-between">
                    <Icon className={cn('h-4 w-4', active ? 'text-orange-600' : 'text-slate-600')} />
                    {activeConnected && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                  </div>
                  <span className="text-xs font-semibold text-slate-900">{card.title}</span>
                  <span className="mt-0.5 text-[10px] leading-tight text-slate-500">{card.subtitle}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Transport-specific connection panel */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          {selectedTab === 'usb' && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900">Direct USB Thermal Printer (WebUSB)</p>
              <p className="text-xs text-slate-500">
                Works with Epson TM-T20/T82/T88, Star TSP100/143, Xprinter XP-80/58, Rongta, BIXOLON, Sunmi, Gprinter,
                and generic POS-58/POS-80 USB printers. Prints directly without a browser dialog.
              </p>
              {!snap.capabilities.usb && (
                <p className="text-xs font-medium text-amber-700">
                  WebUSB is not available in this browser. Open SomBill in Chrome or Edge, or use OS Driver / LAN mode.
                </p>
              )}
              <Button
                variant="orange"
                icon={<Usb className="h-4 w-4" />}
                loading={snap.busy}
                disabled={!snap.capabilities.usb}
                onClick={() =>
                  void run(() => thermalPrinter.connectUsb(), 'USB thermal printer connected and ready.')
                }
              >
                {snap.settings.transport === 'usb' && snap.connected ? 'Change USB Printer' : 'Connect USB Printer'}
              </Button>
            </div>
          )}

          {selectedTab === 'serial' && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900">USB-Serial / COM / RS-232 Thermal Printer</p>
              <p className="text-xs text-slate-500">
                Works with virtual COM-port thermal printers (CP2102, CH340, FTDI, Prolific) and paired Bluetooth SPP
                COM ports. Most printers use 9600 or 115200 baud.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-40">
                  <Select
                    label="Baud rate"
                    value={String(baud)}
                    onChange={(e) => {
                      const next = Number(e.target.value) as SerialBaudRate;
                      setBaud(next);
                      thermalPrinter.updateSettings({ serialBaudRate: next });
                    }}
                  >
                    {BAUD_RATES.map((b) => (
                      <option key={b} value={b}>
                        {b} bps
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  variant="orange"
                  icon={<Cable className="h-4 w-4" />}
                  loading={snap.busy}
                  disabled={!snap.capabilities.serial}
                  onClick={() =>
                    void run(() => thermalPrinter.connectSerial(baud), 'Serial thermal printer connected and ready.')
                  }
                >
                  {snap.settings.transport === 'serial' && snap.connected
                    ? 'Change Serial Port'
                    : 'Connect Serial Port'}
                </Button>
              </div>
              {!snap.capabilities.serial && (
                <p className="text-xs font-medium text-amber-700">
                  Web Serial is not available in this browser. Use Chrome or Edge.
                </p>
              )}
            </div>
          )}

          {selectedTab === 'bluetooth' && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900">Bluetooth BLE Thermal Printer</p>
              <p className="text-xs text-slate-500">
                Works with portable 58mm and 80mm Bluetooth thermal printers (Xprinter, Rongta, Munbyn, Goojprt,
                MTP-2/MTP-3, Sunmi). Turn on the printer and click Connect.
              </p>
              {!snap.capabilities.bluetooth && (
                <p className="text-xs font-medium text-amber-700">
                  Web Bluetooth is not available in this browser. Use Chrome or Edge on desktop/Android.
                </p>
              )}
              <Button
                variant="orange"
                icon={<Bluetooth className="h-4 w-4" />}
                loading={snap.busy}
                disabled={!snap.capabilities.bluetooth}
                onClick={() =>
                  void run(() => thermalPrinter.connectBluetooth(), 'Bluetooth thermal printer connected and ready.')
                }
              >
                {snap.settings.transport === 'bluetooth' && snap.connected
                  ? 'Change Bluetooth Printer'
                  : 'Connect Bluetooth Printer'}
              </Button>
            </div>
          )}

          {selectedTab === 'network' && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900">Network / Ethernet / Wi-Fi Thermal Printer</p>
              <p className="text-xs text-slate-500">
                Print to any LAN thermal printer by IP address. For raw TCP port 9100 printers, run{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px]">npm run print-bridge</code> on
                the POS computer. For Epson TM-Net printers, select Epson ePOS XML.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Select
                  label="Protocol"
                  value={netProtocol}
                  onChange={(e) => {
                    const p = e.target.value as NetworkProtocol;
                    setNetProtocol(p);
                    setNetPort(p === 'epos' ? '80' : '9100');
                  }}
                >
                  <option value="bridge">Raw TCP :9100 (Bridge)</option>
                  <option value="epos">Epson ePOS-Print XML</option>
                </Select>
                <Input
                  label="Printer IP Address"
                  value={netHost}
                  onChange={(e) => setNetHost(e.target.value)}
                  placeholder="192.168.1.100"
                />
                <Input
                  label="TCP Port"
                  type="number"
                  value={netPort}
                  onChange={(e) => setNetPort(e.target.value)}
                  placeholder="9100"
                />
              </div>
              {netProtocol === 'bridge' && (
                <Input
                  label="Local Print Bridge URL"
                  value={bridgeUrl}
                  onChange={(e) => setBridgeUrl(e.target.value)}
                  placeholder="http://localhost:9191/print"
                />
              )}
              <Button
                variant="orange"
                icon={<Wifi className="h-4 w-4" />}
                onClick={() => {
                  const portNum = Math.max(1, Math.min(65535, Number(netPort) || 9100));
                  thermalPrinter.configureNetwork({
                    networkProtocol: netProtocol,
                    networkHost: netHost,
                    networkPort: portNum,
                    bridgeUrl,
                  });
                  toast.success(`LAN printer saved (${netHost.trim()}:${portNum}).`);
                }}
              >
                Save & Use LAN Printer
              </Button>
            </div>
          )}

          {selectedTab === 'browser' && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900">System / OS Thermal Printer Driver</p>
              <p className="text-xs text-slate-500">
                Uses your operating system print dialog with exact {snap.settings.paperWidth}mm continuous thermal paper
                sizing. Works with every thermal printer brand installed on Windows, macOS, Android, or iPadOS.
              </p>
              <Button
                variant={snap.settings.transport === 'browser' ? 'secondary' : 'orange'}
                icon={<Monitor className="h-4 w-4" />}
                onClick={() => {
                  thermalPrinter.useBrowserDriver();
                  toast.success(`Switched to System Driver (${snap.settings.paperWidth}mm).`);
                }}
              >
                {snap.settings.transport === 'browser' ? 'Currently Active' : 'Use System Driver'}
              </Button>
            </div>
          )}
        </div>

        {/* Paper, Cutter & Cash Drawer Settings */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            2. Paper Roll, Cutter & Cash Drawer
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select
              label="Paper width"
              value={String(snap.settings.paperWidth)}
              onChange={(e) => thermalPrinter.updateSettings({ paperWidth: Number(e.target.value) as PaperWidthMm })}
            >
              <option value="80">80mm (Standard · 48 cols)</option>
              <option value="58">58mm (Compact · 32 cols)</option>
            </Select>
            <Select
              label="Auto-cutter"
              value={snap.settings.cut}
              onChange={(e) => thermalPrinter.updateSettings({ cut: e.target.value as CutMode })}
            >
              <option value="partial">Partial cut (default)</option>
              <option value="full">Full cut</option>
              <option value="none">No cut (tear bar)</option>
            </Select>
            <Select
              label="Receipt copies"
              value={String(snap.settings.copies)}
              onChange={(e) => thermalPrinter.updateSettings({ copies: Number(e.target.value) as 1 | 2 })}
            >
              <option value="1">1 copy</option>
              <option value="2">2 copies (Customer + Counter)</option>
            </Select>
          </div>
          <div className="mt-3 flex flex-wrap gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={snap.settings.openDrawerOnCash}
                onChange={(e) => thermalPrinter.updateSettings({ openDrawerOnCash: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              />
              Open cash drawer automatically on cash payments
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={snap.settings.beepOnPrint}
                onChange={(e) => thermalPrinter.updateSettings({ beepOnPrint: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              />
              Beep printer buzzer on print
            </label>
          </div>
        </div>

        {/* Hardware Test Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Printer className="h-4 w-4" />}
              disabled={!canHardwareTest || snap.busy}
              onClick={() =>
                void run(() => thermalPrinter.printTestPage(r.name), 'Test ticket sent to thermal printer.')
              }
            >
              Print Test Ticket
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Coins className="h-4 w-4" />}
              disabled={!canHardwareTest || snap.busy}
              onClick={() => void run(() => thermalPrinter.openCashDrawer(), 'Cash drawer kick pulse sent.')}
            >
              Open Cash Drawer
            </Button>
          </div>
          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
