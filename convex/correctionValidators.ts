import { v } from "convex/values";
import { CORRECTION_FIELDS, type CorrectionField } from "../shared/corrections";
const fields = Object.keys(CORRECTION_FIELDS) as [CorrectionField, ...CorrectionField[]];
export const correctionFieldValidator = v.union(...fields.map(field => v.literal(field)));
export const correctionValidator = v.object({
  field: correctionFieldValidator,
  note: v.string(),
  status: v.union(v.literal("requested"), v.literal("submitted")),
});
