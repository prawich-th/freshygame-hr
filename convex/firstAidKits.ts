import { ConvexError, v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin, requireEditor, requireRecordsAccess } from "./access";
import { catalog } from "./sportCatalog";
import { FACULTIES } from "../shared/faculties";

const MAX_KITS = 100;
// Allow small clock drift between staff devices and the server.
const FUTURE_TOLERANCE = 5 * 60 * 1000;

const loan = v.object({
  id: v.id("firstAidKitLoans"),
  kitId: v.id("firstAidKits"),
  kitNumber: v.number(),
  borrowerName: v.string(),
  nickname: v.string(),
  phone: v.string(),
  faculty: v.string(),
  studentId: v.string(),
  sport: v.string(),
  borrowedAt: v.number(),
  returnedAt: v.union(v.number(), v.null()),
  returnerName: v.string(),
  returnerStudentId: v.string(),
  note: v.string(),
  borrowedByName: v.union(v.string(), v.null()),
  returnedByName: v.union(v.string(), v.null()),
});

// Public status deliberately omits student IDs and phone numbers.
const publicKit = v.object({
  id: v.id("firstAidKits"),
  number: v.number(),
  label: v.string(),
  current: v.union(v.object({ name: v.string(), nickname: v.string(), faculty: v.string(), sport: v.string(), borrowedAt: v.number() }), v.null()),
});

const kitOverview = v.object({
  id: v.id("firstAidKits"),
  number: v.number(),
  label: v.string(),
  active: v.boolean(),
  current: v.union(loan, v.null()),
  lastReturned: v.union(loan, v.null()),
  loansToday: v.number(),
});

function text(value: string, field: string, max = 100) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) throw new ConvexError(`${field} must contain 1–${max} characters`);
  return trimmed;
}

export function cleanStudentId(value: string) {
  const id = value.trim();
  if (!/^\d{10}$/.test(id)) throw new ConvexError("Student ID must contain exactly 10 digits");
  return id;
}

export function cleanPhone(value: string) {
  let phone = value.replace(/\D/g, "");
  if (phone.startsWith("66")) phone = phone.slice(2).startsWith("0") ? phone.slice(2) : `0${phone.slice(2)}`;
  else if (phone.length === 9 && !phone.startsWith("0")) phone = `0${phone}`;
  if (!/^0\d{9}$/.test(phone)) throw new ConvexError("Phone number must be a 10-digit Thai number beginning with 0");
  return phone;
}

const faculty = v.union(...FACULTIES.map(f => v.literal(f.code)));

function cleanNote(value?: string) {
  const note = value?.trim() ?? "";
  if (note.length > 300) throw new ConvexError("Notes must be at most 300 characters");
  return note || undefined;
}

function checkTime(value: number, field: string) {
  if (!Number.isFinite(value) || value <= 0) throw new ConvexError(`${field} is not a valid time`);
  if (value > Date.now() + FUTURE_TOLERANCE) throw new ConvexError(`${field} cannot be in the future`);
  return value;
}

async function savedBorrower(ctx: QueryCtx | MutationCtx, studentId: string) {
  return ctx.db.query("firstAidBorrowers").withIndex("by_studentId", q => q.eq("studentId", studentId)).unique();
}

/**
 * Resolve a person's details, filling blanks from their earlier logs and remembering
 * anything new so the next visit only needs a student ID.
 */
async function resolvePerson(ctx: MutationCtx, args: { studentId: string; name?: string; nickname?: string; phone?: string; faculty?: string }) {
  const studentId = cleanStudentId(args.studentId);
  const saved = await savedBorrower(ctx, studentId);
  const pick = (value: string | undefined, fallback: string | undefined) => value?.trim() || fallback || "";
  const rawName = pick(args.name, saved?.name);
  const rawNickname = pick(args.nickname, saved?.nickname);
  const rawPhone = pick(args.phone, saved?.phone);
  if (!rawName) throw new ConvexError("Enter your full name");
  if (!rawNickname) throw new ConvexError("Enter your nickname");
  if (!rawPhone) throw new ConvexError("Enter your phone number");
  const rawFaculty = args.faculty || saved?.faculty;
  if (!rawFaculty) throw new ConvexError("Choose your faculty");
  const person = { studentId, name: text(rawName, "Name"), nickname: text(rawNickname, "Nickname", 50), phone: cleanPhone(rawPhone), faculty: rawFaculty };
  if (!saved) await ctx.db.insert("firstAidBorrowers", { ...person, updatedAt: Date.now() });
  else if (saved.name !== person.name || saved.nickname !== person.nickname || saved.phone !== person.phone || saved.faculty !== person.faculty) {
    await ctx.db.patch("firstAidBorrowers", saved._id, { name: person.name, nickname: person.nickname, phone: person.phone, faculty: person.faculty, updatedAt: Date.now() });
  }
  return person;
}

async function openLoan(ctx: QueryCtx | MutationCtx, kitId: Id<"firstAidKits">) {
  return ctx.db.query("firstAidKitLoans").withIndex("by_kitId_and_returnedAt", q => q.eq("kitId", kitId).eq("returnedAt", undefined)).first();
}

async function getKit(ctx: QueryCtx | MutationCtx, kitId: Id<"firstAidKits">) {
  const kit = await ctx.db.get("firstAidKits", kitId);
  if (!kit) throw new ConvexError("First aid kit not found. Refresh and try again.");
  return kit;
}

async function latestLoan(ctx: QueryCtx | MutationCtx, kitId: Id<"firstAidKits">) {
  return ctx.db.query("firstAidKitLoans").withIndex("by_kitId_and_borrowedAt", q => q.eq("kitId", kitId)).order("desc").first();
}

/** Signed-in staff are recorded alongside public log entries; anyone else may log anonymously. */
async function optionalStaff(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return undefined;
  const user = await ctx.db.get("users", userId);
  return user?.role && user.active !== false ? userId : undefined;
}

async function audit(ctx: MutationCtx, staffUserId: Id<"users"> | undefined, action: string) {
  await ctx.db.insert("auditEvents", { action, ipAddress: staffUserId ? "authenticated-staff-session" : "public-first-aid-log", staffUserId, successful: true, attempts: 1, createdAt: Date.now() });
}

async function present(ctx: QueryCtx, row: Doc<"firstAidKitLoans">, names: Map<Id<"users">, string | null>) {
  const name = async (id?: Id<"users">) => {
    if (!id) return null;
    if (!names.has(id)) names.set(id, (await ctx.db.get("users", id))?.name ?? null);
    return names.get(id) ?? null;
  };
  return {
    id: row._id, kitId: row.kitId, kitNumber: row.kitNumber,
    borrowerName: row.borrowerName, nickname: row.nickname, phone: row.phone, faculty: row.faculty ?? "", studentId: row.studentId, sport: row.sport,
    borrowedAt: row.borrowedAt, returnedAt: row.returnedAt ?? null,
    returnerName: row.returnerName ?? "", returnerStudentId: row.returnerStudentId ?? "", note: row.note ?? "",
    borrowedByName: await name(row.borrowedBy), returnedByName: await name(row.returnedBy),
  };
}

// ---------- Public logging (no account required) ----------

export const publicStatus = query({
  args: {},
  returns: v.array(publicKit),
  handler: async ctx => {
    const kits = await ctx.db.query("firstAidKits").withIndex("by_number").take(MAX_KITS);
    return Promise.all(kits.filter(kit => kit.active).map(async kit => {
      const current = await openLoan(ctx, kit._id);
      return {
        id: kit._id, number: kit.number, label: kit.label ?? "",
        current: current ? { name: current.borrowerName, nickname: current.nickname, faculty: current.faculty ?? "", sport: current.sport, borrowedAt: current.borrowedAt } : null,
      };
    }));
  },
});

const publicMovement = v.object({ sport: v.string(), nickname: v.string(), faculty: v.string(), borrowedAt: v.number(), returnedAt: v.union(v.number(), v.null()) });

/** Read-only public tracking: where each kit is and which sports it has visited since `dayStart`. */
export const publicTracking = query({
  args: { dayStart: v.number() },
  returns: v.array(publicKit.extend({ today: v.array(publicMovement) })),
  handler: async (ctx, { dayStart }) => {
    // Only recent history is public; older entries stay in the staff log.
    const since = Math.max(dayStart, Date.now() - 2 * 24 * 60 * 60 * 1000);
    const kits = await ctx.db.query("firstAidKits").withIndex("by_number").take(MAX_KITS);
    return Promise.all(kits.filter(kit => kit.active).map(async kit => {
      const current = await openLoan(ctx, kit._id);
      const today = await ctx.db.query("firstAidKitLoans").withIndex("by_kitId_and_borrowedAt", q => q.eq("kitId", kit._id).gte("borrowedAt", since)).take(30);
      return {
        id: kit._id, number: kit.number, label: kit.label ?? "",
        current: current ? { name: current.borrowerName, nickname: current.nickname, faculty: current.faculty ?? "", sport: current.sport, borrowedAt: current.borrowedAt } : null,
        today: today.map(row => ({ sport: row.sport, nickname: row.nickname, faculty: row.faculty ?? "", borrowedAt: row.borrowedAt, returnedAt: row.returnedAt ?? null })),
      };
    }));
  },
});

/** Sport names for the public form's suggestions; borrowers can still type any activity. */
export const sportOptions = query({
  args: {},
  returns: v.array(v.string()),
  handler: async ctx => [...(await catalog(ctx)).map(s => s.thai ? `${s.thai} / ${s.name}` : s.name), "Katakorn", "Cheerleader", "Parade", "Support team"],
});

/** Lets a returning borrower skip retyping. Only a masked phone number is revealed. */
export const knownBorrower = query({
  args: { studentId: v.string() },
  returns: v.union(v.object({ name: v.string(), nickname: v.string(), faculty: v.string(), phoneHint: v.string() }), v.null()),
  handler: async (ctx, { studentId }) => {
    const id = studentId.trim();
    if (!/^\d{10}$/.test(id)) return null;
    const saved = await savedBorrower(ctx, id);
    return saved ? { name: saved.name, nickname: saved.nickname, faculty: saved.faculty ?? "", phoneHint: `•••-•••-${saved.phone.slice(-4)}` } : null;
  },
});

const person = {
  studentId: v.string(),
  name: v.optional(v.string()),
  nickname: v.optional(v.string()),
  phone: v.optional(v.string()),
  faculty: v.optional(faculty),
};

export const checkOut = mutation({
  args: { kitId: v.id("firstAidKits"), sport: v.string(), note: v.optional(v.string()), handover: v.optional(v.boolean()), borrowedAt: v.optional(v.number()), ...person },
  returns: v.id("firstAidKitLoans"),
  handler: async (ctx, args) => {
    const staffId = await optionalStaff(ctx);
    if (args.borrowedAt !== undefined && !staffId) throw new ConvexError("Only signed-in staff can record an earlier borrow time");
    const kit = await getKit(ctx, args.kitId);
    if (!kit.active) throw new ConvexError(`Kit ${kit.number} is retired`);
    const borrower = await resolvePerson(ctx, args);
    const sport = text(args.sport, "Sport / activity");
    const note = cleanNote(args.note);
    const borrowedAt = checkTime(args.borrowedAt ?? Date.now(), "Borrow time");
    const current = await openLoan(ctx, kit._id);
    if (current && !args.handover) throw new ConvexError(`Kit ${kit.number} is already with ${current.borrowerName} (${current.sport}). Return it first, or choose “Take over” if it is being handed to you directly.`);
    const previous = await latestLoan(ctx, kit._id);
    if (previous && borrowedAt < (previous.returnedAt ?? previous.borrowedAt)) throw new ConvexError("Borrow time must be after the kit's previous log entry");
    if (current) {
      // A handover closes the current loan and opens the next one at the same moment.
      await ctx.db.patch("firstAidKitLoans", current._id, { returnedAt: borrowedAt, returnerName: borrower.name, returnerStudentId: borrower.studentId, returnedBy: staffId });
    }
    const id = await ctx.db.insert("firstAidKitLoans", {
      kitId: kit._id, kitNumber: kit.number,
      borrowerName: borrower.name, nickname: borrower.nickname, phone: borrower.phone, faculty: borrower.faculty, studentId: borrower.studentId,
      sport, note, borrowedAt, borrowedBy: staffId,
    });
    await audit(ctx, staffId, `first_aid_kit_${current ? "handed_over" : "checked_out"}:${kit.number}:${sport}:${borrower.studentId}`);
    return id;
  },
});

export const checkIn = mutation({
  args: { kitId: v.id("firstAidKits"), studentId: v.string(), name: v.optional(v.string()), returnedAt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const staffId = await optionalStaff(ctx);
    if (args.returnedAt !== undefined && !staffId) throw new ConvexError("Only signed-in staff can record an earlier return time");
    const kit = await getKit(ctx, args.kitId);
    const current = await openLoan(ctx, kit._id);
    if (!current) throw new ConvexError(`Kit ${kit.number} is not checked out`);
    const studentId = cleanStudentId(args.studentId);
    const saved = studentId === current.studentId ? { name: current.borrowerName } : await savedBorrower(ctx, studentId);
    const returnerName = text(args.name?.trim() || saved?.name || "", "Name of the person returning the kit");
    const returnedAt = checkTime(args.returnedAt ?? Date.now(), "Return time");
    if (returnedAt < current.borrowedAt) throw new ConvexError("Return time must be after the borrow time");
    await ctx.db.patch("firstAidKitLoans", current._id, { returnedAt, returnerName, returnerStudentId: studentId, returnedBy: staffId });
    await audit(ctx, staffId, `first_aid_kit_returned:${kit.number}:${current.sport}:${studentId}`);
    return null;
  },
});

// ---------- Staff overview and log management ----------

export const overview = query({
  args: { dayStart: v.number() },
  returns: v.array(kitOverview),
  handler: async (ctx, { dayStart }) => {
    await requireRecordsAccess(ctx);
    const kits = await ctx.db.query("firstAidKits").withIndex("by_number").take(MAX_KITS);
    const names = new Map<Id<"users">, string | null>();
    return Promise.all(kits.map(async kit => {
      const current = await openLoan(ctx, kit._id);
      const today = await ctx.db.query("firstAidKitLoans").withIndex("by_kitId_and_borrowedAt", q => q.eq("kitId", kit._id).gte("borrowedAt", dayStart)).take(50);
      const recent = await ctx.db.query("firstAidKitLoans").withIndex("by_kitId_and_borrowedAt", q => q.eq("kitId", kit._id)).order("desc").take(5);
      const lastReturned = recent.find(row => row.returnedAt !== undefined);
      return {
        id: kit._id, number: kit.number, label: kit.label ?? "", active: kit.active,
        current: current ? await present(ctx, current, names) : null,
        lastReturned: lastReturned ? await present(ctx, lastReturned, names) : null,
        loansToday: today.length,
      };
    }));
  },
});

export const log = query({
  args: { paginationOpts: paginationOptsValidator, kitId: v.optional(v.id("firstAidKits")) },
  returns: paginationResultValidator(loan),
  handler: async (ctx, { paginationOpts, kitId }) => {
    await requireRecordsAccess(ctx);
    const page = kitId
      ? await ctx.db.query("firstAidKitLoans").withIndex("by_kitId_and_borrowedAt", q => q.eq("kitId", kitId)).order("desc").paginate(paginationOpts)
      : await ctx.db.query("firstAidKitLoans").withIndex("by_borrowedAt").order("desc").paginate(paginationOpts);
    const names = new Map<Id<"users">, string | null>();
    return { ...page, page: await Promise.all(page.page.map(row => present(ctx, row, names))) };
  },
});

export const addKits = mutation({
  args: { count: v.number(), label: v.optional(v.string()) },
  returns: v.array(v.number()),
  handler: async (ctx, { count, label }) => {
    const staff = await requireAdmin(ctx);
    if (!Number.isInteger(count) || count < 1 || count > 50) throw new ConvexError("Add between 1 and 50 kits at a time");
    const cleanLabel = label?.trim() ?? "";
    if (cleanLabel.length > 60) throw new ConvexError("Labels must be at most 60 characters");
    const existing = await ctx.db.query("firstAidKits").withIndex("by_number").take(MAX_KITS + 1);
    if (existing.length + count > MAX_KITS) throw new ConvexError(`A maximum of ${MAX_KITS} first aid kits is supported`);
    let next = (existing.at(-1)?.number ?? 0) + 1;
    const numbers: number[] = [];
    for (let i = 0; i < count; i++, next++) {
      await ctx.db.insert("firstAidKits", { number: next, label: cleanLabel || undefined, active: true });
      numbers.push(next);
    }
    await audit(ctx, staff.userId, `first_aid_kits_added:${numbers.join(",")}`);
    return numbers;
  },
});

export const updateKit = mutation({
  args: { kitId: v.id("firstAidKits"), label: v.string(), active: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { kitId, label, active }) => {
    const staff = await requireAdmin(ctx);
    const kit = await getKit(ctx, kitId);
    const cleanLabel = label.trim();
    if (cleanLabel.length > 60) throw new ConvexError("Labels must be at most 60 characters");
    if (!active && await openLoan(ctx, kitId)) throw new ConvexError(`Kit ${kit.number} is checked out. Record its return before retiring it.`);
    await ctx.db.patch("firstAidKits", kitId, { label: cleanLabel || undefined, active });
    await audit(ctx, staff.userId, `first_aid_kit_updated:${kit.number}:${active ? "active" : "retired"}`);
    return null;
  },
});

export const updateLoan = mutation({
  args: {
    loanId: v.id("firstAidKitLoans"), borrowerName: v.string(), nickname: v.string(), phone: v.string(), faculty, studentId: v.string(),
    sport: v.string(), note: v.optional(v.string()), borrowedAt: v.number(), returnedAt: v.union(v.number(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const staff = await requireEditor(ctx);
    const row = await ctx.db.get("firstAidKitLoans", args.loanId);
    if (!row) throw new ConvexError("Log entry not found. Refresh and try again.");
    const borrowedAt = checkTime(args.borrowedAt, "Borrow time");
    const returnedAt = args.returnedAt === null ? undefined : checkTime(args.returnedAt, "Return time");
    if (returnedAt !== undefined && returnedAt < borrowedAt) throw new ConvexError("Return time must be after the borrow time");
    if (returnedAt === undefined && row.returnedAt !== undefined) {
      if (await openLoan(ctx, row.kitId)) throw new ConvexError(`Kit ${row.kitNumber} is already checked out to someone else. Record that return first.`);
      if ((await latestLoan(ctx, row.kitId))?._id !== row._id) throw new ConvexError("Only the kit's most recent checkout can be reopened");
    }
    await ctx.db.patch("firstAidKitLoans", row._id, {
      borrowerName: text(args.borrowerName, "Name"), nickname: text(args.nickname, "Nickname", 50), phone: cleanPhone(args.phone), faculty: args.faculty,
      studentId: cleanStudentId(args.studentId), sport: text(args.sport, "Sport / activity"), note: cleanNote(args.note),
      borrowedAt, returnedAt,
      ...(returnedAt === undefined ? { returnerName: undefined, returnerStudentId: undefined, returnedBy: undefined } : {}),
    });
    await audit(ctx, staff.userId, `first_aid_kit_log_corrected:${row.kitNumber}:${args.sport.trim()}`);
    return null;
  },
});

export const deleteLoan = mutation({
  args: { loanId: v.id("firstAidKitLoans") },
  returns: v.null(),
  handler: async (ctx, { loanId }) => {
    const staff = await requireAdmin(ctx);
    const row = await ctx.db.get("firstAidKitLoans", loanId);
    if (!row) throw new ConvexError("Log entry not found. Refresh and try again.");
    await ctx.db.delete("firstAidKitLoans", loanId);
    await audit(ctx, staff.userId, `first_aid_kit_log_deleted:${row.kitNumber}:${row.sport}:${row.studentId}`);
    return null;
  },
});
