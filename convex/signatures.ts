import { ConvexError, v } from "convex/values";
import type { Signature } from "../shared/signature";
export const signatureValidator = v.array(v.array(v.object({ x: v.number(), y: v.number() })));
export function certifySignature(signature: Signature | undefined, signedName: string) {
  const points = signature?.flat() ?? [];
  if (!signature?.length || signature.length > 100 || points.length < 2 || points.length > 5000 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 600 || p.y < 0 || p.y > 180) || !points.some(p => Math.hypot(p.x - points[0].x, p.y - points[0].y) > 5)) {
    throw new ConvexError("Please draw your signature and certify your documents / Please sign before submitting");
  }
  return { signature, signedName, signedAt: Date.now() };
}
