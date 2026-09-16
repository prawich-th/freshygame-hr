import { ConvexError, v } from "convex/values";
import { isValidSignature, type Signature } from "../shared/signature";
export const signatureValidator = v.array(v.array(v.object({ x: v.number(), y: v.number() })));
export function certifySignature(signature: Signature | undefined, signedName: string) {
  if (!isValidSignature(signature)) {
    throw new ConvexError("Please draw your signature and certify your documents / Please sign before submitting");
  }
  return { signature, signedName, signedAt: Date.now() };
}
