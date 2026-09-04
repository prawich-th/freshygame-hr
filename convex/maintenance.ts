import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const backfillParticipantOrderNumbers = internalMutation({
  args: {},
  returns: v.object({ updated: v.number(), total: v.number() }),
  handler: async (ctx) => {
    const participants = await ctx.db.query("participants").order("asc").take(500);
    const used = new Set(participants.flatMap((participant) => participant.orderNumber ? [participant.orderNumber] : []));
    let nextOrderNumber = 1;
    let updated = 0;

    for (const participant of participants) {
      if (participant.orderNumber) continue;
      while (used.has(nextOrderNumber)) nextOrderNumber += 1;
      await ctx.db.patch("participants", participant._id, { orderNumber: nextOrderNumber });
      used.add(nextOrderNumber);
      nextOrderNumber += 1;
      updated += 1;
    }
    return { updated, total: participants.length };
  },
});
