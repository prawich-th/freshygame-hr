import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import { requireAdmin, requireStaff } from "./access";
import schema from "./schema";
import { SPORTS } from "../shared/sports";
import { participantCategories } from "../shared/participantCategories";
import { participantKind } from "../shared/participantKinds";

const event = v.object({ name: v.string(), aliases: v.array(v.string()) });
const definition = v.object({ code: v.string(), name: v.string(), thai: v.string(), aliases: v.array(v.string()), events: v.array(event), types: v.array(v.string()) });
const key = (s: string) => s.trim().toLowerCase();
const clean = (s: string) => {
  const value = s.trim();
  if (!value || value.length > 100) throw new ConvexError("Names must contain 1–100 characters");
  return value;
};

export async function catalog(ctx: QueryCtx | MutationCtx) {
  const saved = await ctx.db.query("sportCatalog").withIndex("by_code").take(201);
  if (saved.length > 200) throw new ConvexError("Sport catalog limit exceeded");
  const defaults = SPORTS.filter(s => !saved.some(row => row.code === s.code)).map(s => ({
    code: s.code, name: s.name, thai: s.thai,
    aliases: [s.code, s.name, s.thai, `${s.thai} / ${s.name}`],
    events: s.types.map(name => ({ name, aliases: [name] })),
  }));
  return [...defaults, ...saved.map(({ code, name, thai, aliases, events }) => ({ code, name, thai, aliases, events }))]
    .map(s => ({ ...s, types: s.events.map(e => e.name) }));
}

export async function resolveSport(ctx: QueryCtx | MutationCtx, value: string) {
  return (await catalog(ctx)).find(s => [s.code, s.name, s.thai, ...s.aliases].some(alias => key(alias) === key(value)));
}
export function resolveCategories(sport: Awaited<ReturnType<typeof resolveSport>>, values: string[]) {
  return [...new Set(values.map(value => sport?.events.find(e => [e.name, ...e.aliases].some(alias => key(alias) === key(value)))?.name ?? value))];
}

export const list = query({
  args: {}, returns: v.array(definition),
  handler: async ctx => { await requireStaff(ctx); return catalog(ctx); },
});

export const migrationPreview = query({
  args: { code: v.string() },
  returns: v.object({ participants: v.number(), categories: v.array(v.object({ name: v.string(), participants: v.number() })), history: v.array(schema.doc("sportMigrations")) }),
  handler: async (ctx, { code }) => {
    await requireAdmin(ctx);
    const sport = (await catalog(ctx)).find(s => s.code === code);
    if (!sport) throw new ConvexError("Sport not found");
    const rows = await linkedParticipants(ctx, sport);
    const counts = new Map<string, number>(sport.types.map(name => [name, 0]));
    for (const p of rows) for (const category of participantCategories(p)) counts.set(category, (counts.get(category) ?? 0) + 1);
    return { participants: rows.length, categories: [...counts].map(([name, participants]) => ({ name, participants })), history: await ctx.db.query("sportMigrations").withIndex("by_sportCode", q => q.eq("sportCode", code)).order("desc").take(50) };
  },
});

async function linkedParticipants(ctx: QueryCtx | MutationCtx, sport: { name: string; aliases: string[] }) {
  const rows = [];
  for (const alias of new Set([sport.name, ...sport.aliases])) {
    const matches = await ctx.db.query("participants").withIndex("by_sport", q => q.eq("sport", alias)).take(2001);
    rows.push(...matches.filter(p => participantKind(p) === "athlete"));
    if (rows.length > 2000 || matches.length > 2000) throw new ConvexError("This sport is too large for an atomic migration. Contact the system administrator.");
  }
  return rows;
}

export const save = mutation({
  args: { code: v.string(), expectedName: v.optional(v.string()), name: v.string(), thai: v.string(), category: v.optional(v.object({ oldName: v.optional(v.string()), name: v.string() })) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const staff = await requireAdmin(ctx);
    const all = await catalog(ctx);
    const code = clean(args.code).toUpperCase();
    const old = all.find(s => s.code === code);
    if (old?.name !== args.expectedName) throw new ConvexError("This sport changed. Refresh and try again.");
    if (!old && all.length >= 200) throw new ConvexError("A maximum of 200 sports is supported");
    const name = clean(args.name), thai = args.thai.trim();
    if (thai.length > 100) throw new ConvexError("Thai names must be at most 100 characters");
    const aliases = [...new Set([...(old?.aliases ?? []), code, name, ...(thai ? [thai, `${thai} / ${name}`] : [])])];
    if (aliases.length > 200) throw new ConvexError("Rename history limit reached");
    if (aliases.some(a => ["support team", "katakorn", "cheerleader", "parade"].includes(key(a)))) throw new ConvexError("This name is reserved for an activity");
    if (all.some(s => s.code !== code && [s.name, s.code, s.thai, ...s.aliases].some(a => aliases.some(b => key(a) === key(b))))) throw new ConvexError("Another sport already uses this name or code");
    const rows = await linkedParticipants(ctx, old ?? { name, aliases: [] });
    if (new Set(rows.map(p => p.studentId)).size !== rows.length) throw new ConvexError("Duplicate registrations exist under this sport's old names. Resolve them before migrating.");
    const events = (old?.events ?? []).map(e => ({ ...e }));
    if (args.category) {
      const next = clean(args.category.name);
      const index = events.findIndex(e => e.name === args.category!.oldName);
      if (args.category.oldName && index < 0 && !rows.some(p => participantCategories(p).includes(args.category!.oldName!))) throw new ConvexError("Old category not found. Refresh and try again.");
      const targetIndex = events.findIndex((e, i) => i !== index && [e.name, ...e.aliases].some(a => key(a) === key(next)));
      if (targetIndex >= 0 && !args.category.oldName) throw new ConvexError("This category already exists in the sport");
      const target = events[targetIndex];
      const renamed = { name: target?.name ?? next, aliases: [...new Set([...(target?.aliases ?? []), ...(events[index]?.aliases ?? []), ...(args.category.oldName ? [args.category.oldName] : []), next])] };
      if (renamed.aliases.length > 200) throw new ConvexError("Rename history limit reached");
      if (targetIndex >= 0) {
        events[targetIndex] = renamed;
        if (index >= 0) events.splice(index, 1);
      } else if (index < 0) events.push(renamed); else events[index] = renamed;
    }
    if (events.length > 200) throw new ConvexError("A maximum of 200 categories per sport is supported");
    const updated = { code, name, thai, aliases, events };
    let affected = 0;
    // A single transaction publishes the catalog and every linked registration together.
    // Reject oversized operations before writing rather than publish a partial rename.
    const jobs = await ctx.db.query("participantRemovalJobs").withIndex("by_status", q => q.eq("status", "running")).take(1);
    const paused = await ctx.db.query("participantRemovalJobs").withIndex("by_status", q => q.eq("status", "paused")).take(1);
    if (jobs.length || paused.length) throw new ConvexError("Finish the participant removal job before editing sports");
    for (const p of rows) {
      if (participantKind(p) !== "athlete") continue;
      const categories = resolveCategories({ ...updated, types: events.map(e => e.name) }, participantCategories(p));
      if (p.sport === name && JSON.stringify(categories) === JSON.stringify(participantCategories(p))) continue;
      await ctx.db.patch("participants", p._id, { sport: name, categories, category: categories[0], updatedAt: Date.now(), updatedBy: staff.userId, signature: undefined, signedName: undefined, signedAt: undefined });
      affected++;
    }
    if (old && old.name !== name) await ctx.db.insert("sportMigrations", { sportCode: code, kind: "sport", oldValue: old.name, newValue: name, affected, createdAt: Date.now(), createdBy: staff.userId });
    if (args.category?.oldName && args.category.oldName !== args.category.name.trim()) await ctx.db.insert("sportMigrations", { sportCode: code, kind: "category", oldValue: args.category.oldName, newValue: resolveCategories({ ...updated, types: events.map(e => e.name) }, [args.category.name.trim()])[0], affected, createdAt: Date.now(), createdBy: staff.userId });
    const stored = await ctx.db.query("sportCatalog").withIndex("by_code", q => q.eq("code", code)).unique();
    if (stored) await ctx.db.patch("sportCatalog", stored._id, updated);
    else await ctx.db.insert("sportCatalog", updated);
    await ctx.db.insert("auditEvents", { action: `sport_catalog_updated:${code}:${name}:${args.category?.name ?? ""}:participants=${affected}`, ipAddress: "authenticated-staff-session", staffUserId: staff.userId, successful: true, attempts: 1, createdAt: Date.now() });
    return affected;
  },
});

export const deleteCategory = mutation({
  args: { code: v.string(), name: v.string() },
  returns: v.null(),
  handler: async (ctx, { code, name }) => {
    const staff = await requireAdmin(ctx);
    const sport = (await catalog(ctx)).find(s => s.code === code);
    const category = sport?.events.find(e => e.name === name);
    if (!sport || !category) throw new ConvexError("Category not found. Refresh and try again.");
    // Check canonical and historical category names in the same transaction as deletion.
    const rows = await linkedParticipants(ctx, sport);
    if (rows.some(p => resolveCategories(sport, participantCategories(p)).includes(name))) {
      throw new ConvexError("This category is used by participants. Migrate them to another category before deleting it.");
    }
    const { code: sportCode, name: sportName, thai, aliases } = sport;
    const updated = { code: sportCode, name: sportName, thai, aliases, events: sport.events.filter(e => e.name !== name) };
    const stored = await ctx.db.query("sportCatalog").withIndex("by_code", q => q.eq("code", code)).unique();
    // Persist overrides even for defaults, including deletion of the last category.
    if (stored) await ctx.db.patch("sportCatalog", stored._id, updated);
    else await ctx.db.insert("sportCatalog", updated);
    await ctx.db.insert("auditEvents", { action: `sport_category_deleted:${code}:${name}`, ipAddress: "authenticated-staff-session", staffUserId: staff.userId, successful: true, attempts: 1, createdAt: Date.now() });
    return null;
  },
});
