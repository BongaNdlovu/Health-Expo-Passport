/* Libraries loaded from CDNs (or Capacitor) that the app reads as globals. */
declare const supabase: { createClient: Function };
declare const QRCode: any;
declare const BarcodeDetector: any;
declare const Html5Qrcode: any;
interface Window {
  supabase?: { createClient: Function };
  Capacitor?: any;
  QRCode?: any;
  NEWSTART_NO_CLOUD?: boolean;
  /* nsmem.js (loaded before the app): the shared caches, timers and low-memory handling */
  NSMem?: {
    devBuild: boolean;
    Cache: new (name: string, opts?: { max?: number; ttl?: number }) => { get(k: any): any; set(k: any, v: any): any; memo(k: any, fn: () => any): any; clear(): void };
    bump(why?: string): void;
    clearAll(): void;
    every(group: string, fn: () => void, ms: number): any;
    after(group: string, fn: () => void, ms: number): any;
    release(group: string): void;
    openDiag(force?: boolean): void;
    [k: string]: any;
  };
  /* tutorial/tour.js: the guided tour */
  NSTour?: { start(): void; offer(why?: string): void; status?(): string; [k: string]: any };
  /* the secure store (index.html) starts the app once the saved data is decrypted */
  __secureReady?: boolean;
  __bootApp?: (() => void) | null;
}
