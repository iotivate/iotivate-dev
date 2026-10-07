/**
 * Thin wrappers around the Meta Pixel's fbq(). All no-op safely when the Pixel
 * isn't loaded (env unset, dev, or blocked by an ad blocker), so callers never
 * need to guard. See MetaPixel.tsx for the base snippet.
 */
type PixelParams = Record<string, string | number | undefined>;

function fbq(): ((...args: unknown[]) => void) | undefined {
  return typeof window !== "undefined" ? window.fbq : undefined;
}

/** Fire a Meta standard event (e.g. "Lead", "Purchase") — what ads optimize toward. */
export function pixelTrack(event: string, params?: PixelParams): void {
  fbq()?.("track", event, params);
}

/** Fire a Meta custom event for signals with no standard name (e.g. "Quote"). */
export function pixelTrackCustom(event: string, params?: PixelParams): void {
  fbq()?.("trackCustom", event, params);
}
