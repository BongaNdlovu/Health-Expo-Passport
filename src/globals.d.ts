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
}
