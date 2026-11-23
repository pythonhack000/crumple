/** Player-drawn balls are small PNG data URLs. */
export const BALL_ART = {
  size: 72,
  maxBytes: 32 * 1024,
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

/** What a ball is made of. It changes how the ball looks and sounds, never how it moves. */
export const MATERIALS = ['paper', 'rubber', 'tin', 'glass'] as const;
export type Material = (typeof MATERIALS)[number];

export function parseMaterial(value: unknown): Material {
  return MATERIALS.find((material) => material === value) ?? 'paper';
}
