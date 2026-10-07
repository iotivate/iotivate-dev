// Meta (Facebook) Pixel global, injected by the base snippet in MetaPixel.tsx.
interface Window {
  fbq?: (...args: unknown[]) => void;
  _fbq?: unknown;
}
