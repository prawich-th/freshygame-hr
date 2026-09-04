import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireEditor, requireStaff } from "./access";
import schema from "./schema";

const participantInput = v.object({
  participantKind: v.optional(
    v.union(v.literal("athlete"), v.literal("performer")),
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
    throw new Error(`Phone number for Student ID ${studentId} could not be cleaned to a valid 10-digit Thai number`);
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
  participantKind: v.union(v.literal("athlete"), v.literal("performer")),
  category: v.union(v.string(), v.null()),
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
      role: v.union(v.literal("admin"), v.literal("registrar"), v.literal("viewer")),
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
        canBootstrap: admin === null,
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
    const staff = await requireStaff(ctx);
    const admin = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "admin")).first();
    if (admin) throw new Error("An administrator already exists");
    await ctx.db.patch("users", staff.userId, { role: "admin" });
    return null;
  },
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(listItem),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
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
          sport: participant.sport,
          participantKind: participant.participantKind ?? "athlete",
          category: participant.category ?? null,
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
    const staff = await requireStaff(ctx);
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
    await requireStaff(ctx);
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
    const staff = await requireStaff(ctx);
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
    const staff = await requireStaff(ctx);
    if (args.participantIds.length === 0) return [];
    if (args.participantIds.length > 50) throw new Error("Export at most 50 participants per PDF");

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

export const importBatch = mutation({
  args: { participants: v.array(participantInput) },
  returns: v.object({ created: v.number(), updated: v.number() }),
  handler: async (ctx, args) => {
    const staff = await requireEditor(ctx);
    if (args.participants.length > 100) throw new Error("Import at most 100 rows per batch");
    const lastOrderedParticipant = await ctx.db.query("participants").withIndex("by_orderNumber").order("desc").first();
    let nextOrderNumber = (lastOrderedParticipant?.orderNumber ?? 0) + 1;
    let created = 0;
    let updated = 0;
    for (const row of args.participants) {
      const studentId = row.studentId.trim();
      if (!studentId || !row.fullNameEnglish.trim()) continue;
      if (!/^\d{10}$/.test(studentId)) {
        throw new Error(`Student ID ${studentId} must contain exactly 10 digits`);
      }
      const faculty = row.faculty.trim();
      if (![
        "คณะแพทยศาสตร์",
        "คณะศิลปศาสตร์",
        "คณะแพทยศาสตร์นานาชาติจุฬาภรณ์",
      ].includes(faculty)) {
        throw new Error(`Student ID ${studentId} has an unsupported faculty`);
      }
      const existing = await ctx.db.query("participants").withIndex("by_studentId", (q) => q.eq("studentId", studentId)).unique();
      const { email: rawEmail, phone: rawPhone, ...participantFields } = row;
      const phone = normalizePhone(rawPhone, studentId);
      const email = rawEmail?.trim().toLowerCase() || undefined;
      const data = {
        ...participantFields,
        faculty,
        participantKind: row.performerType ? "performer" as const : "athlete" as const,
        studentId,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        status: existing?.nationalIdImageId && existing?.studentIdImageId && existing?.profilePhotoId ? "pending" as const : "incomplete" as const,
        source: "import" as const,
        updatedAt: Date.now(),
        updatedBy: staff.userId,
      };
      if (existing) {
        await ctx.db.patch("participants", existing._id, data);
        updated += 1;
      } else {
        await ctx.db.insert("participants", { ...data, orderNumber: nextOrderNumber });
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
    if (!participant) throw new Error("Participant not found");
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
    participantKind: v.union(v.literal("athlete"), v.literal("performer")),
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
      v.literal("คณะแพทยศาสตร์นานาชาติจุฬาภรณ์"),
    ),
    sport: v.string(),
    category: v.optional(v.string()),
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
    if (!participant) throw new Error("Participant not found");

    const studentId = args.studentId.trim();
    const fullNameThai = args.fullNameThai.trim();
    const fullNameEnglish = args.fullNameEnglish.trim();
    const faculty = args.faculty.trim();
    const sport = args.sport.trim();
    if (!/^\d{10}$/.test(studentId)) throw new Error("Student ID must contain exactly 10 digits");
    if (!fullNameThai || !fullNameEnglish || !faculty || !sport) {
      throw new Error("Student ID, names, faculty, and activity are required");
    }
    if (args.participantKind === "performer" && !args.performerType) {
      throw new Error("Choose a performer team");
    }

    if (studentId !== participant.studentId) {
      const duplicate = await ctx.db
        .query("participants")
        .withIndex("by_studentId", (q) => q.eq("studentId", studentId))
        .unique();
      if (duplicate) throw new Error("Another participant already uses this Student ID");
    }

    const phone = normalizePhone(args.phone, studentId);
    const email = args.email?.trim().toLowerCase() || undefined;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Please enter a valid email address");
    }

    await ctx.db.patch("participants", participant._id, {
      participantKind: args.participantKind,
      performerType: args.participantKind === "performer" ? args.performerType : undefined,
      studentId,
      fullNameThai,
      fullNameEnglish,
      nicknameThai: args.nicknameThai?.trim() || undefined,
      nicknameEnglish: args.nicknameEnglish?.trim() || undefined,
      sex: args.sex?.trim() || undefined,
      faculty,
      sport: args.participantKind === "performer" && args.performerType
        ? args.performerType
        : sport,
      category: args.category?.trim() || undefined,
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
    if (!participant) throw new Error("Participant not found");
    if (!args.profilePhotoId && !args.nationalIdImageId && !args.studentIdImageId) {
      throw new Error("Choose at least one image to upload");
    }
    const hasCompleteDocumentSet = Boolean(
      (args.profilePhotoId || participant.profilePhotoId) &&
      (args.nationalIdImageId || participant.nationalIdImageId) &&
      (args.studentIdImageId || participant.studentIdImageId),
    );
    await ctx.db.patch("participants", args.participantId, {
      ...(args.profilePhotoId ? { profilePhotoId: args.profilePhotoId } : {}),
      ...(args.nationalIdImageId ? { nationalIdImageId: args.nationalIdImageId } : {}),
      ...(args.studentIdImageId ? { studentIdImageId: args.studentIdImageId } : {}),
      status: hasCompleteDocumentSet
        ? args.uploadedFromBooth ? "verified" : "pending"
        : "incomplete",
      source: "staff",
      updatedAt: Date.now(),
      updatedBy: staff.userId,
    });
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
  returns: v.array(v.object({ id: v.id("users"), name: v.string(), email: v.string(), role: v.union(v.literal("admin"), v.literal("registrar"), v.literal("viewer")), active: v.boolean() })),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").take(100);
    return users.filter((u) => u.role).map((u) => ({ id: u._id, name: u.name ?? "Staff", email: u.email ?? "", role: u.role!, active: u.active !== false }));
  },
});

export const updateStaffRole = mutation({
  args: { userId: v.id("users"), role: v.union(v.literal("admin"), v.literal("registrar"), v.literal("viewer")), active: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const staff = await requireAdmin(ctx);
    if (staff.userId === args.userId && !args.active) throw new Error("You cannot deactivate your own account");
    const target = await ctx.db.get("users", args.userId);
    if (!target?.role) throw new Error("Staff member not found");
    if (target.role === "admin" && (args.role !== "admin" || !args.active)) {
      const admins = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "admin")).take(100);
      if (!admins.some((admin) => admin._id !== args.userId && admin.active !== false)) {
        throw new Error("Assign another active administrator first");
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
