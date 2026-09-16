export type Signature = { x: number; y: number }[][];
export const SIGNATURE_WIDTH = 600;
export const SIGNATURE_HEIGHT = 180;

/** Require actual ink within a stroke; separate taps must not count as a signature. */
export function isValidSignature(signature: Signature | undefined): boolean {
  if (!signature?.length || signature.length > 100) return false;
  const points = signature.flat();
  if (points.length < 2 || points.length > 5000 || points.some(point =>
    !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > SIGNATURE_WIDTH || point.y < 0 || point.y > SIGNATURE_HEIGHT,
  )) return false;
  return signature.some(stroke => stroke.length > 1 && stroke.some(point => Math.hypot(point.x - stroke[0].x, point.y - stroke[0].y) > 5));
}
