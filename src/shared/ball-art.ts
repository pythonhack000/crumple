/** Player-drawn balls are small PNG data URLs. */
export const BALL_ART = {
  size: 48,
  maxBytes: 16 * 1024,
  prefix: 'data:image/png;base64,',
} as const;

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Accepts only a small PNG data URL; anything else is rejected. */
export function parseBallArt(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith(BALL_ART.prefix)) return undefined;
  const body = value.slice(BALL_ART.prefix.length);
  if (body.length === 0 || (body.length * 3) / 4 > BALL_ART.maxBytes || !BASE64.test(body)) return undefined;
  // PNG files start with the bytes 89 50 4E 47, which is "iVBORw" in base64.
  return body.startsWith('iVBORw') ? value : undefined;
}
