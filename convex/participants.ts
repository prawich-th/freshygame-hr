import { participantCategories } from "../shared/participantCategories";
import { completeDocuments, existingDocuments, linkDocuments } from "./participantDocuments";
import { internal } from "./_generated/api";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireAdmin, requireEditor, requireStaff, requireRecordsAccess } from "./access";
import schema from "./schema";
import { participantKind as resolveKind, SUPPORT_TYPES } from "../shared/participantKinds";
import { findSport, normalizeSport } from "../shared/sports";

const participantInput = v.object({
  participantKind: v.optional(
    v.union(v.literal("athlete"), v.literal("performer"), v.literal("support")),
  ),
  performerType: v.optional(
    v.union(
      v.literal("Katakorn"),
      v.literal("Cheerleader"),
      v.literal("Parade"),
    ),
  ),
  email: v.optional(v.string()),
  sportOrder: v.optional(v.string()),
  studentId: v.string(),
  fullNameThai: v.string(),
  fullNameEnglish: v.string(),
  nicknameThai: v.optional(v.string()),
  nicknameEnglish: v.optional(v.string()),
  sex: v.optional(v.string()),
  faculty: v.string(),
  facultyCode: v.optional(v.string()),
  phone: v.optional(v.string()),
  lineId: v.optional(v.string()),
  instagram: v.optional(v.string()),
  preferredContact: v.optional(v.string()),
  qualificationCriteria: v.optional(v.string()),
  pdpaConsent: v.optional(v.string()),
  qualificationDetails: v.optional(v.string()),
  eligibilityCertification: v.optional(v.string()),
  sport: v.string(),
  category: v.optional(v.string()),
  categories: v.optional(v.array(v.string())),
});

function normalizePhone(value: string | undefined, studentId: string) {
  if (!value?.trim()) return undefined;
  let phone = value.replace(/\D/g, "");
  if (phone.startsWith("66")) {
    const localNumber = phone.slice(2);
    phone = localNumber.startsWith("0") ? localNumber : `0${localNumber}`;
  } else if (phone.length === 9 && !phone.startsWith("0")) {
    phone = `0${phone}`;
  }
  if (!/^0\d{9}$/.test(phone)) {
    throw new ConvexError(`Phone number for Student ID ${studentId} could not be cleaned to a valid 10-digit Thai number`);
  }
  return phone;
}

const listItem = v.object({
  _id: v.id("participants"),
  _creationTime: v.number(),
  studentId: v.string(),
  fullNameThai: v.string(),
  fullNameEnglish: v.string(),
  email: v.string(),
  phone: v.string(),
  faculty: v.string(),
  sport: v.string(),
  participantKind: v.union(v.literal("athlete"), v.literal("performer"), v.literal("support")),
  category: v.union(v.string(), v.null()),
  categories: v.array(v.string()),
  status: v.union(v.literal("incomplete"), v.literal("pending"), v.literal("verified"), v.literal("rejected")),
  hasNationalId: v.boolean(),
  photoUrl: v.union(v.string(), v.null()),
  updatedAt: v.number(),
});

const boothParticipant = v.object({
  _id: v.id("participants"),
  studentId: v.string(),
  fullNameThai: v.string(),
  fullNameEnglish: v.string(),
  faculty: v.string(),
  sport: v.string(),
  status: v.union(v.literal("incomplete"), v.literal("pending"), v.literal("verified"), v.literal("rejected")),
  hasProfilePhoto: v.boolean(),
  hasNationalId: v.boolean(),
  hasStudentId: v.boolean(),
});

export const currentStaff = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      id: v.id("users"),
      name: v.string(),
      email: v.string(),
      role: v.union(v.literal("admin"), v.literal("registrar"), v.literal("viewer"), v.literal("co-sport")),
      canBootstrap: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    try {
      const { userId, user, role } = await requireStaff(ctx);
      const admin = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "admin")).first();
      return {
        id: userId,
        name: user.name ?? "Staff member",
        email: user.email ?? "",
        role,
        canBootstrap: admin === null && role !== "co-sport",
      };
    } catch {
      return null;
    }
  },
});

export const bootstrapAdmin = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const staff = await requireRecordsAccess(ctx);
    const admin = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "admin")).first();
    if (admin) throw new ConvexError("An administrator already exists");
    await ctx.db.patch("users", staff.userId, { role: "admin" });
    return null;
  },
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(listItem),
  handler: async (ctx, args) => {
    await requireRecordsAccess(ctx);
    const page = await ctx.db.query("participants").order("desc").paginate(args.paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (participant) => ({
          _id: participant._id,
          _creationTime: participant._creationTime,
          studentId: participant.studentId,
          fullNameThai: participant.fullNameThai,
          fullNameEnglish: participant.fullNameEnglish,
          email: participant.email ?? "",
          phone: participant.phone ?? "",
          faculty: participant.faculty,
          sport: resolveKind(participant) === "support" ? "Support team" : participant.sport,
          participantKind: resolveKind(participant),
          category: participant.category ?? null,
          categories: participantCategories(participant),
          status: participant.status,
          hasNationalId: Boolean(participant.nationalIdImageId),
          photoUrl: participant.profilePhotoId
            ? await ctx.storage.getUrl(participant.profilePhotoId)
            : null,
          updatedAt: participant.updatedAt,
        }))),
    };
  },
});

export const boothSearch = query({
  args: { search: v.string() },
  returns: v.array(boothParticipant),
  handler: async (ctx, args) => {
    await requireEditor(ctx);
    const search = args.search.trim();
    if (search.length < 2) return [];

    const matches = /^\d+$/.test(search)
      ? await ctx.db
          .query("participants")
          .withSearchIndex("search_studentId", (q) => q.search("studentId", search))
          .take(12)
      : (
          await Promise.all([
            ctx.db
              .query("participants")
              .withSearchIndex("search_fullNameThai", (q) => q.search("fullNameThai", search))
              .take(8),
            ctx.db
              .query("participants")
              .withSearchIndex("search_fullNameEnglish", (q) => q.search("fullNameEnglish", search))
              .take(8),
          ])
        ).flat();

    return [...new Map(matches.map((participant) => [participant._id, participant])).values()]
      .slice(0, 12)
      .map((participant) => ({
        _id: participant._id,
        studentId: participant.studentId,
        fullNameThai: participant.fullNameThai,
        fullNameEnglish: participant.fullNameEnglish,
        faculty: participant.faculty,
        sport: participant.sport,
        status: participant.status,
        hasProfilePhoto: Boolean(participant.profilePhotoId),
        hasNationalId: Boolean(participant.nationalIdImageId),
        hasStudentId: Boolean(participant.studentIdImageId),
      }));
  },
});

export const get = query({
  args: { participantId: v.id("participants") },
  returns: v.union(v.null(), v.object({ participant: schema.doc("participants"), photoUrl: v.union(v.string(), v.null()), nationalIdImageUrl: v.union(v.string(), v.null()), studentIdImageUrl: v.union(v.string(), v.null()) })),
  handler: async (ctx, args) => {
    const staff = await requireRecordsAccess(ctx);
    const participant = await ctx.db.get("participants", args.participantId);
    if (!participant) return null;
    const protectedParticipant = staff.role === "viewer"
      ? { ...participant, nationalIdImageId: undefined, studentIdImageId: undefined }
      : participant;
    return {
      participant: protectedParticipant,
      photoUrl: participant.profilePhotoId ? await ctx.storage.getUrl(participant.profilePhotoId) : null,
      nationalIdImageUrl: staff.role !== "viewer" && participant.nationalIdImageId ? await ctx.storage.getUrl(participant.nationalIdImageId) : null,
      studentIdImageUrl: staff.role !== "viewer" && participant.studentIdImageId ? await ctx.storage.getUrl(participant.studentIdImageId) : null,
    };
  },
});

export const stats = query({
  args: {},
  returns: v.object({ total: v.number(), complete: v.number(), pending: v.number(), sports: v.number() }),
  handler: async (ctx) => {
    await requireRecordsAccess(ctx);
    const participants = await ctx.db.query("participants").order("desc").take(1000);
    return {
      total: participants.length,
      complete: participants.filter((p) => p.status === "verified").length,
      pending: participants.filter((p) => p.status === "pending").length,
      sports: new Set(participants.map((p) => p.sport).filter(Boolean)).size,
    };
  },
});

export const exportSport = query({
  args: { sport: v.string() },
  returns: v.array(v.object({ participant: schema.doc("participants"), photoUrl: v.union(v.string(), v.null()), nationalIdImageUrl: v.union(v.string(), v.null()), studentIdImageUrl: v.union(v.string(), v.null()) })),
  handler: async (ctx, args) => {
    const staff = await requireRecordsAccess(ctx);
    const participants = await ctx.db
      .query("participants")
      .withIndex("by_sport", (q) => q.eq("sport", args.sport))
      .take(200);
    return await Promise.all(participants.map(async (participant) => ({
      participant: staff.role === "viewer"
        ? { ...participant, nationalIdImageId: undefined, studentIdImageId: undefined }
        : participant,
      photoUrl: participant.profilePhotoId ? await ctx.storage.getUrl(participant.profilePhotoId) : null,
      nationalIdImageUrl: staff.role !== "viewer" && participant.nationalIdImageId ? await ctx.storage.getUrl(participant.nationalIdImageId) : null,
      studentIdImageUrl: staff.role !== "viewer" && participant.studentIdImageId ? await ctx.storage.getUrl(participant.studentIdImageId) : null,
    })));
  },
});

export const exportSelected = query({
  args: { participantIds: v.array(v.id("participants")) },
  returns: v.array(v.object({ participant: schema.doc("participants"), photoUrl: v.union(v.string(), v.null()), nationalIdImageUrl: v.union(v.string(), v.null()), studentIdImageUrl: v.union(v.string(), v.null()) })),
  handler: async (ctx, args) => {
    const staff = await requireRecordsAccess(ctx);
    if (args.participantIds.length === 0) return [];
    if (args.participantIds.length > 50) throw new ConvexError("Export at most 50 participants per PDF");

    const entries = [];
    for (const participantId of args.participantIds) {
      const participant = await ctx.db.get("participants", participantId);
      if (!participant) continue;
      entries.push({
        participant: staff.role === "viewer"
          ? { ...participant, nationalIdImageId: undefined, studentIdImageId: undefined }
          : participant,
        photoUrl: participant.profilePhotoId ? await ctx.storage.getUrl(participant.profilePhotoId) : null,
        nationalIdImageUrl: staff.role !== "viewer" && participant.nationalIdImageId ? await ctx.storage.getUrl(participant.nationalIdImageId) : null,
        studentIdImageUrl: staff.role !== "viewer" && participant.studentIdImageId ? await ctx.storage.getUrl(participant.studentIdImageId) : null,
      });
    }
    return entries;
  },
});

export const createParticipant = mutation({
  args: { participant: participantInput, incomplete: v.optional(v.boolean()) },
  returns: v.id("participants"),
  handler: async (ctx, { participant: row, incomplete }) => {
    const staff = await requireEditor(ctx);
    if (incomplete) await requireAdmin(ctx);
    const studentId = row.studentId.trim();
    const fullNameThai = row.fullNameThai.trim();
    const fullNameEnglish = row.fullNameEnglish.trim();
    const faculty = row.faculty.trim();
    if (!/^\d{10}$/.test(studentId)) throw new ConvexError("Student ID must contain exactly 10 digits");
    if (!incomplete && (!fullNameThai || !fullNameEnglish)) throw new ConvexError("Thai and English names are required");
    if ((faculty || !incomplete) && !["คณะแพทยศาสตร์", "คณะศิลปศาสตร์", "วิทยาลัยแพทยศาสตร์นานาชาติจุฬาภรณ์"].includes(faculty)) throw new ConvexError("Choose a supported faculty");
    const participantKind = resolveKind(row);
    if (participantKind === "performer" && !row.performerType) throw new ConvexError("Choose a performer team");
    const sportDefinition = findSport(row.sport);
    const categories = participantCategories(row);
    const category = participantKind === "athlete" ? categories[0] : row.category?.trim();
    if (participantKind === "support" && !SUPPORT_TYPES.includes(category ?? "")) throw new ConvexError("Choose Camera or Support team");
    if (participantKind === "athlete" && (!sportDefinition || !categories.length || categories.some(value => !sportDefinition.types.includes(value)))) throw new ConvexError("Choose a sport and event type");
    const activity = participantKind === "support" ? "Support team" : participantKind === "performer" ? row.performerType! : sportDefinition!.name;
    const duplicate = await ctx.db.query("participants").withIndex("by_studentId_and_sport", q => q.eq("studentId", studentId).eq("sport", activity)).unique();
    if (duplicate) throw new ConvexError("This Student ID is already registered for this sport or activity. Open that registration to edit it.");
    const phone = normalizePhone(row.phone, studentId);
    if (incomplete && !phone) throw new ConvexError("A registered phone number is required so the athlete can verify their identity");
    const email = row.email?.trim().toLowerCase() || undefined;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ConvexError("Please enter a valid email address");
    const last = await ctx.db.query("participants").withIndex("by_orderNumber").order("desc").first();
    const now = Date.now();
    const documents = await existingDocuments(ctx, studentId);
    const participantId = await ctx.db.insert("participants", {
      ...documents,
      ...row, studentId, fullNameThai, fullNameEnglish, faculty, participantKind,
      performerType: participantKind === "performer" ? row.performerType : undefined,
      sport: participantKind === "support" ? "Support team" : participantKind === "performer" ? row.performerType! : sportDefinition!.name,
      category, categories: participantKind === "athlete" ? categories : undefined, phone, email, status: fullNameThai && fullNameEnglish && faculty && completeDocuments(documents) ? "pending" : "incomplete", source: "staff",
      orderNumber: (last?.orderNumber ?? 0) + 1, updatedAt: now, updatedBy: staff.userId,
    });
    await ctx.db.insert("auditEvents", { action: "staff_participant_created", ipAddress: "authenticated-staff-session", participantId, staffUserId: staff.userId, successful: true, attempts: 1, createdAt: now });
    return participantId;
  },
});

export const importBatch = mutation({
  args: { participants: v.array(participantInput) },
  returns: v.object({ created: v.number(), updated: v.number() }),
  handler: async (ctx, args) => {
    const staff = await requireEditor(ctx);
    if (args.participants.length > 100) throw new ConvexError("Import at most 100 rows per batch");
    const lastOrderedParticipant = await ctx.db.query("participants").withIndex("by_orderNumber").order("desc").first();
    let nextOrderNumber = (lastOrderedParticipant?.orderNumber ?? 0) + 1;
    let created = 0;
    let updated = 0;
    for (const row of args.participants) {
      const studentId = row.studentId.trim();
      if (!studentId || !row.fullNameEnglish.trim()) continue;
      if (!/^\d{10}$/.test(studentId)) {
        throw new ConvexError(`Student ID ${studentId} must contain exactly 10 digits`);
      }
      const faculty = row.faculty.trim();
      if (![
        "คณะแพทยศาสตร์",
        "คณะศิลปศาสตร์",
        "วิทยาลัยแพทยศาสตร์นานาชาติจุฬาภรณ์",
      ].includes(faculty)) {
        throw new ConvexError(`Student ID ${studentId} has an unsupported faculty`);
      }
      if (resolveKind(row) === "support" && !SUPPORT_TYPES.includes(row.category?.trim() ?? "")) throw new ConvexError(`Student ID ${studentId}: Choose Camera or Support team`);
      const activity = resolveKind(row) === "support" ? "Support team" : row.performerType ?? normalizeSport(row.sport);
      const existing = await ctx.db.query("participants").withIndex("by_studentId_and_sport", (q) => q.eq("studentId", studentId).eq("sport", activity)).unique();
      const { email: rawEmail, phone: rawPhone, ...participantFields } = row;
      const phone = normalizePhone(rawPhone, studentId);
      const email = rawEmail?.trim().toLowerCase() || undefined;
      const categories = participantCategories({ categories: [...(existing && resolveKind(existing) === "athlete" ? participantCategories(existing) : []), ...participantCategories(row)] });
      const data = {
        ...participantFields,
        ...(resolveKind(row) === "athlete" ? { categories, category: categories[0] } : { categories: undefined }),
        sport: resolveKind(row) === "support" ? "Support team" : row.performerType ?? normalizeSport(row.sport),
        performerType: resolveKind(row) === "support" ? undefined : row.performerType,
        faculty,
        participantKind: resolveKind(row) === "support" ? "support" as const : row.performerType ? "performer" as const : "athlete" as const,
        studentId,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        status: existing?.status ?? "incomplete" as const,
        source: "import" as const,
        updatedAt: Date.now(),
        updatedBy: staff.userId,
      };
      if (existing) {
        await ctx.db.patch("participants", existing._id, data);
        updated += 1;
      } else {
        const documents = await existingDocuments(ctx, studentId);
        await ctx.db.insert("participants", { ...data, ...documents, status: completeDocuments(documents) ? "pending" : "incomplete", orderNumber: nextOrderNumber });
        nextOrderNumber += 1;
        created += 1;
      }
    }
    return { created, updated };
  },
});

export const updateStatus = mutation({
  args: {
    participantId: v.id("participants"),
    status: v.union(v.literal("incomplete"), v.literal("pending"), v.literal("verified"), v.literal("rejected")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const staff = await requireEditor(ctx);
    const participant = await ctx.db.get("participants", args.participantId);
    if (!participant) throw new ConvexError("Participant not found");
    await ctx.db.patch("participants", args.participantId, {
      status: args.status,
      updatedAt: Date.now(),
      updatedBy: staff.userId,
    });
    await ctx.db.insert("auditEvents", {
      action: `staff_status_${args.status}`,
      ipAddress: "authenticated-staff-session",
      participantId: participant._id,
      staffUserId: staff.userId,
      successful: true,
      attempts: 1,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const updateParticipant = mutation({
  args: {
    participantId: v.id("participants"),
    participantKind: v.union(v.literal("athlete"), v.literal("performer"), v.literal("support")),
    performerType: v.optional(
      v.union(
        v.literal("Katakorn"),
        v.literal("Cheerleader"),
        v.literal("Parade"),
      ),
    ),
    studentId: v.string(),
    fullNameThai: v.string(),
    fullNameEnglish: v.string(),
    nicknameThai: v.optional(v.string()),
    nicknameEnglish: v.optional(v.string()),
    sex: v.optional(v.string()),
    faculty: v.union(
      v.literal("คณะแพทยศาสตร์"),
      v.literal("คณะศิลปศาสตร์"),
      v.literal("วิทยาลัยแพทยศาสตร์นานาชาติจุฬาภรณ์"),
    ),
    sport: v.string(),
    category: v.optional(v.string()),
    categories: v.optional(v.array(v.string())),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    lineId: v.optional(v.string()),
    instagram: v.optional(v.string()),
    preferredContact: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const staff = await requireEditor(ctx);
    const participant = await ctx.db.get("participants", args.participantId);
    if (!participant) throw new ConvexError("Participant not found");

    const studentId = args.studentId.trim();
    const fullNameThai = args.fullNameThai.trim();
    const fullNameEnglish = args.fullNameEnglish.trim();
    const faculty = args.faculty.trim();
    const sport = normalizeSport(args.sport);
    if (!/^\d{10}$/.test(studentId)) throw new ConvexError("Student ID must contain exactly 10 digits");
    if (!fullNameThai || !fullNameEnglish || !faculty || !sport) {
      throw new ConvexError("Student ID, names, faculty, and activity are required");
    }
    if (args.participantKind === "performer" && !args.performerType) {
      throw new ConvexError("Choose a performer team");
    }

    if (args.participantKind === "support" && !SUPPORT_TYPES.includes(args.category?.trim() ?? "")) throw new ConvexError("Choose Camera or Support team");

    const categories = participantCategories(args);
    if (args.participantKind === "athlete") {
      const definition = findSport(sport);
      const existingCategories = resolveKind(participant) === "athlete" && normalizeSport(participant.sport) === sport ? participantCategories(participant) : [];
      if (!categories.length || categories.some(value => !definition?.types.includes(value) && !existingCategories.includes(value))) {
        throw new ConvexError("Choose a sport and event type");
      }
    }

    const activity = args.participantKind === "support" ? "Support team" : args.participantKind === "performer" ? args.performerType! : sport;
    const duplicate = await ctx.db.query("participants")
      .withIndex("by_studentId_and_sport", q => q.eq("studentId", studentId).eq("sport", activity))
      .unique();
    if (duplicate && duplicate._id !== participant._id) {
      throw new ConvexError("This Student ID is already registered for this sport or activity");
    }

    const phone = normalizePhone(args.phone, studentId);
    const email = args.email?.trim().toLowerCase() || undefined;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ConvexError("Please enter a valid email address");
    }

    const identityDocuments = studentId !== participant.studentId
      ? { profilePhotoId: undefined, nationalIdImageId: undefined, studentIdImageId: undefined, ...await existingDocuments(ctx, studentId) }
      : {};
    await ctx.db.patch("participants", participant._id, {
      ...identityDocuments,
      ...(studentId !== participant.studentId ? { status: completeDocuments(identityDocuments) ? "pending" as const : "incomplete" as const } : {}),
      participantKind: args.participantKind,
      performerType: args.participantKind === "performer" ? args.performerType : undefined,
      studentId,
      fullNameThai,
      fullNameEnglish,
      nicknameThai: args.nicknameThai?.trim() || undefined,
      nicknameEnglish: args.nicknameEnglish?.trim() || undefined,
      sex: args.sex?.trim() || undefined,
      faculty,
      sport: args.participantKind === "support" ? "Support team" : args.participantKind === "performer" && args.performerType
        ? args.performerType
        : sport,
      category: args.participantKind === "athlete" ? categories[0] : args.category?.trim() || undefined,
      categories: args.participantKind === "athlete" ? categories : undefined,
      email,
      phone,
      lineId: args.lineId?.trim() || undefined,
      instagram: args.instagram?.trim().replace(/^@/, "") || undefined,
      preferredContact: args.preferredContact?.trim() || undefined,
      updatedAt: Date.now(),
      updatedBy: staff.userId,
    });
    await ctx.db.insert("auditEvents", {
      action: "staff_participant_updated",
      ipAddress: "authenticated-staff-session",
      participantId: participant._id,
      staffUserId: staff.userId,
      successful: true,
      attempts: 1,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const generateStaffUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireEditor(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const completeStaffUpload = mutation({
  args: {
    participantId: v.id("participants"),
    profilePhotoId: v.optional(v.id("_storage")),
    nationalIdImageId: v.optional(v.id("_storage")),
    studentIdImageId: v.optional(v.id("_storage")),
    uploadedFromBooth: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const staff = await requireEditor(ctx);
    const participant = await ctx.db.get("participants", args.participantId);
    if (!participant) throw new ConvexError("Participant not found");
    if (!args.profilePhotoId && !args.nationalIdImageId && !args.studentIdImageId) {
      throw new ConvexError("Choose at least one image to upload");
    }
    await linkDocuments(ctx, participant, {
      ...(args.profilePhotoId ? { profilePhotoId: args.profilePhotoId } : {}),
      ...(args.nationalIdImageId ? { nationalIdImageId: args.nationalIdImageId } : {}),
      ...(args.studentIdImageId ? { studentIdImageId: args.studentIdImageId } : {}),
    }, { userId: staff.userId, booth: args.uploadedFromBooth });
    await ctx.db.insert("auditEvents", {
      action: args.uploadedFromBooth
        ? "booth_identity_documents_verified"
        : "staff_identity_documents_updated",
      ipAddress: "authenticated-staff-session",
      participantId: participant._id,
      staffUserId: staff.userId,
      successful: true,
      attempts: 1,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const listStaff = query({
  args: {},
  returns: v.array(v.object({ id: v.id("users"), name: v.string(), email: v.string(), role: v.union(v.literal("admin"), v.literal("registrar"), v.literal("viewer"), v.literal("co-sport")), active: v.boolean() })),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").take(100);
    return users.filter((u) => u.role).map((u) => ({ id: u._id, name: u.name ?? "Staff", email: u.email ?? "", role: u.role!, active: u.active !== false }));
  },
});

export const updateStaffRole = mutation({
  args: { userId: v.id("users"), role: v.union(v.literal("admin"), v.literal("registrar"), v.literal("viewer"), v.literal("co-sport")), active: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const staff = await requireAdmin(ctx);
    if (staff.userId === args.userId && !args.active) throw new ConvexError("You cannot deactivate your own account");
    const target = await ctx.db.get("users", args.userId);
    if (!target?.role) throw new ConvexError("Staff member not found");
    if (target.role === "admin" && (args.role !== "admin" || !args.active)) {
      const admins = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "admin")).take(100);
      if (!admins.some((admin) => admin._id !== args.userId && admin.active !== false)) {
        throw new ConvexError("Assign another active administrator first");
      }
    }
    await ctx.db.patch("users", args.userId, { role: args.role, active: args.active });
    await ctx.db.insert("auditEvents", {
      action: `staff_access_${args.role}_${args.active ? "active" : "inactive"}`,
      ipAddress: "authenticated-staff-session",
      staffUserId: staff.userId,
      successful: true,
      attempts: 1,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const listAuditEvents = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(v.object({
    id: v.id("auditEvents"),
    action: v.string(),
    ipAddress: v.string(),
    participantName: v.union(v.string(), v.null()),
    staffName: v.union(v.string(), v.null()),
    successful: v.union(v.boolean(), v.null()),
    createdAt: v.number(),
  })),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const page = await ctx.db.query("auditEvents").order("desc").paginate(args.paginationOpts);
    return {
      ...page,
      page: await Promise.all(page.page.map(async (event) => {
        const participant = event.participantId ? await ctx.db.get("participants", event.participantId) : null;
        const staff = event.staffUserId ? await ctx.db.get("users", event.staffUserId) : null;
        return {
          id: event._id,
          action: event.action,
          ipAddress: event.ipAddress,
          participantName: participant?.fullNameThai ?? null,
          staffName: staff?.name ?? null,
          successful: event.successful ?? null,
          createdAt: event.createdAt,
        };
      })),
    };
  },
});

// A bounded snapshot makes the confirmation exact; never silently prune a partial list.
const MAX_REMOVAL_REVIEW = 5000;
export const removalCandidates = query({
  args: { sport: v.string() },
  returns: v.array(v.object({ id: v.id("participants"), studentId: v.string(), name: v.string(), thaiName: v.string(), sport: v.string() })),
  handler: async (ctx, {sport}) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("participants").withIndex("by_sport", q => q.eq("sport", sport)).take(MAX_REMOVAL_REVIEW + 1);
    if (rows.length > MAX_REMOVAL_REVIEW) throw new ConvexError("Selection mode supports up to 5,000 participants. No records have been removed. Contact the system administrator for a larger cleanup.");
    return rows.map(p => ({id: p._id, studentId: p.studentId, name: p.fullNameEnglish, thaiName: p.fullNameThai, sport: p.sport}));
  },
});

export const latestRemoval = query({
  args: {},
  returns: v.union(v.null(), v.object({ id: v.id("participantRemovalJobs"), sport: v.optional(v.string()), skippedCount: v.number(), processed: v.number(), removeCount: v.number(), keepCount: v.number(), status: v.union(v.literal("running"), v.literal("paused"), v.literal("complete")) })),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const job = await ctx.db.query("participantRemovalJobs").withIndex("by_creation_time").order("desc").first();
    return job ? {id: job._id, sport: job.sport, skippedCount: job.skippedCount ?? 0, processed: job.nextIndex, removeCount: job.removeCount, keepCount: job.keepCount, status: job.status} : null;
  },
});

export const keepOnlySelected = mutation({
  args: { sport: v.string(), keepIds: v.array(v.id("participants")), reviewedIds: v.array(v.id("participants")), confirmation: v.string() },
  returns: v.id("participantRemovalJobs"),
  handler: async (ctx, args) => {
    const staff = await requireAdmin(ctx);
    if (args.confirmation !== "REMOVE OTHERS") throw new ConvexError("Type REMOVE OTHERS to confirm this removal.");
    const keep = new Set(args.keepIds);
    if (!keep.size) throw new ConvexError("Select at least one participant to keep. Nothing has been removed.");
    if (args.reviewedIds.length > MAX_REMOVAL_REVIEW || args.keepIds.length > MAX_REMOVAL_REVIEW) throw new ConvexError("Selection mode supports up to 5,000 participants. Nothing has been removed.");
    for (const status of ["running", "paused"] as const) {
      if (await ctx.db.query("participantRemovalJobs").withIndex("by_status", q => q.eq("status", status)).first()) throw new ConvexError("A removal is already in progress. Finish or resume it before starting another.");
    }
    const rows = await ctx.db.query("participants").withIndex("by_sport", q => q.eq("sport", args.sport)).take(MAX_REMOVAL_REVIEW + 1);
    const current = new Set(rows.map(p => p._id));
    const reviewed = new Set(args.reviewedIds);
    if (rows.length > MAX_REMOVAL_REVIEW || reviewed.size !== current.size || [...current].some(id => !reviewed.has(id)) || [...keep].some(id => !current.has(id))) throw new ConvexError("The participant list changed after your review. Close selection mode and reopen it to review the updated list before removing anyone.");
    const participantIds = rows.filter(p => !keep.has(p._id)).map(p => p._id);
    if (!participantIds.length) throw new ConvexError("All participants are selected to keep. There is nobody to remove.");
    const jobId = await ctx.db.insert("participantRemovalJobs", {sport: args.sport, skippedCount: 0, participantIds, nextIndex: 0, removeCount: participantIds.length, keepCount: keep.size, status: "running", createdBy: staff.userId});
    await ctx.db.insert("auditEvents", {action: `participant_removal_${args.sport}_started_keep_${keep.size}_remove_${participantIds.length}`, ipAddress: "authenticated-staff-session", staffUserId: staff.userId, successful: true, attempts: 1, createdAt: Date.now()});
    await ctx.scheduler.runAfter(0, internal.participants.runRemoval, {jobId});
    return jobId;
  },
});

export const resumeRemoval = mutation({
  args: { jobId: v.id("participantRemovalJobs") }, returns: v.null(),
  handler: async (ctx, {jobId}) => {
    await requireAdmin(ctx);
    const job = await ctx.db.get("participantRemovalJobs", jobId);
    if (!job || job.status !== "paused") throw new ConvexError("This removal is not paused. Refresh the page to see its current progress.");
    await ctx.db.patch("participantRemovalJobs", jobId, {status: "running"});
    await ctx.scheduler.runAfter(0, internal.participants.runRemoval, {jobId});
    return null;
  },
});

export const runRemoval = internalMutation({
  args: {jobId: v.id("participantRemovalJobs")}, returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    try { await ctx.runMutation(internal.participants.removalBatch, args); }
    catch {
      // Subtransaction rolls back the failed batch; earlier batches remain complete.
      await ctx.db.patch("participantRemovalJobs", args.jobId, {status: "paused"});
    }
    return null;
  },
});

export const removalBatch = internalMutation({
  args: {jobId: v.id("participantRemovalJobs")}, returns: v.null(),
  handler: async (ctx, {jobId}): Promise<null> => {
    const job = await ctx.db.get("participantRemovalJobs", jobId);
    if (!job || job.status !== "running") return null;
    let nextIndex = job.nextIndex;
    let skippedCount = job.skippedCount ?? 0;
    for (let count = 0; count < 10 && nextIndex < job.participantIds.length; count++) {
      const id = job.participantIds[nextIndex];
      const participant = await ctx.db.get("participants", id);
      if (participant && job.sport && participant.sport !== job.sport) {
        skippedCount++; nextIndex++; continue;
      }
      if (participant) {
        await ctx.db.delete("participants", id);
        for (const fileId of new Set([participant.profilePhotoId, participant.nationalIdImageId, participant.studentIdImageId])) {
          if (!fileId) continue;
          // Preserve any image also referenced by a retained participant.
          const refs = await Promise.all([
            ctx.db.query("participants").withIndex("by_profilePhotoId", q => q.eq("profilePhotoId", fileId)).first(),
            ctx.db.query("participants").withIndex("by_nationalIdImageId", q => q.eq("nationalIdImageId", fileId)).first(),
            ctx.db.query("participants").withIndex("by_studentIdImageId", q => q.eq("studentIdImageId", fileId)).first(),
          ]);
          if (!refs.some(Boolean)) await ctx.storage.delete(fileId);
        }
      }
      const sessions = await ctx.db.query("uploadSessions").withIndex("by_participantId", q => q.eq("participantId", id)).take(50);
      for (const session of sessions) await ctx.db.delete("uploadSessions", session._id);
      if (sessions.length === 50) break; // Continue this participant's remaining sessions next batch.
      nextIndex++;
    }
    const complete = nextIndex === job.participantIds.length;
    await ctx.db.patch("participantRemovalJobs", jobId, {nextIndex, skippedCount, status: complete ? "complete" : "running", ...(complete ? {participantIds: []} : {})});
    if (complete) await ctx.db.insert("auditEvents", {action: `participant_removal_completed_${job.removeCount - skippedCount}`, ipAddress: "authenticated-staff-session", staffUserId: job.createdBy, successful: true, attempts: 1, createdAt: Date.now()});
    else await ctx.scheduler.runAfter(0, internal.participants.runRemoval, {jobId});
    return null;
  },
});
