import { participantCategories } from "../shared/participantCategories";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireStaff } from "./access";
import { participantKind } from "../shared/participantKinds";

// Explicit allowlist: never return participant documents or storage references.
const contact = v.object({
  _id: v.id("participants"),
  fullNameThai: v.string(), fullNameEnglish: v.string(),
  nicknameThai: v.string(), nicknameEnglish: v.string(),
  faculty: v.string(), sport: v.string(), category: v.string(), categories: v.array(v.string()),
  participantKind: v.string(), phone: v.string(), email: v.string(),
  lineId: v.string(), instagram: v.string(), preferredContact: v.string(),
});

export const search = query({
  args: { term: v.string() },
  returns: v.object({ contacts: v.array(contact), hasMore: v.boolean() }),
  handler: async (ctx, { term }) => {
    await requireStaff(ctx);
    const text = term.trim().slice(0, 100);
    if (text.length < 2) return { contacts: [], hasMore: false };
    const groups = await Promise.all([
      ctx.db.query("participants").withSearchIndex("search_fullNameThai", q => q.search("fullNameThai", text)).take(26),
      ctx.db.query("participants").withSearchIndex("search_fullNameEnglish", q => q.search("fullNameEnglish", text)).take(26),
      ctx.db.query("participants").withSearchIndex("search_nicknameThai", q => q.search("nicknameThai", text)).take(26),
      ctx.db.query("participants").withSearchIndex("search_nicknameEnglish", q => q.search("nicknameEnglish", text)).take(26),
      ctx.db.query("participants").withSearchIndex("search_email", q => q.search("email", text)).take(26),
      ctx.db.query("participants").withSearchIndex("search_phone", q => q.search("phone", text)).take(26),
      ctx.db.query("participants").withSearchIndex("search_faculty", q => q.search("faculty", text)).take(26),
      ctx.db.query("participants").withSearchIndex("search_sport", q => q.search("sport", text)).take(26),
    ]);
    const matches = [...new Map(groups.flat().map(p => [p._id, p])).values()];
    return {
      hasMore: matches.length > 25,
      contacts: matches.slice(0, 25).map(p => ({
        _id: p._id, fullNameThai: p.fullNameThai, fullNameEnglish: p.fullNameEnglish,
        nicknameThai: p.nicknameThai ?? "", nicknameEnglish: p.nicknameEnglish ?? "",
        faculty: p.faculty, sport: p.sport, category: p.category ?? "", categories: participantCategories(p),
        participantKind: participantKind(p), phone: p.phone ?? "", email: p.email ?? "",
        lineId: p.lineId ?? "", instagram: p.instagram ?? "", preferredContact: p.preferredContact ?? "",
      })),
    };
  },
});
