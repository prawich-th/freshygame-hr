import { ConvexError, v } from "convex/values";
import { existingDocuments, linkDocuments, registrationsForStudent } from "./participantDocuments";
import { mutation } from "./_generated/server";

const profileInput = v.object({
  fullNameThai: v.string(), fullNameEnglish: v.string(), faculty: v.string(),
  nicknameThai: v.optional(v.string()), nicknameEnglish: v.optional(v.string()),
  sex: v.optional(v.string()), email: v.optional(v.string()),
  lineId: v.optional(v.string()), instagram: v.optional(v.string()), preferredContact: v.optional(v.string()),
});

function normalizePhone(value: string) {
  let phone = value.replace(/\D/g, "");
  if (phone.startsWith("66")) {
    const localNumber = phone.slice(2);
    phone = localNumber.startsWith("0") ? localNumber : `0${localNumber}`;
  } else if (phone.length === 9 && !phone.startsWith("0")) {
    phone = `0${phone}`;
  }
  return /^0\d{9}$/.test(phone) ? phone : null;
}

export const recordVisit = mutation({
  args: {
    ipAddress: v.string(),
    userAgent: v.optional(v.string()),
    purpose: v.optional(
      v.union(v.literal("document_upload"), v.literal("performer_registration")),
    ),
  },
  returns: v.id("auditEvents"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("auditEvents", {
      action: args.purpose === "performer_registration"
        ? "performer_registration_visit"
        : "self_upload_visit",
      ipAddress: args.ipAddress.slice(0, 128),
      userAgent: args.userAgent?.slice(0, 512),
      attempts: 0,
      createdAt: Date.now(),
    });
  },
});

export const registerPerformer = mutation({
  args: {
    auditEventId: v.id("auditEvents"),
    performerType: v.union(v.literal("Katakorn"), v.literal("Cheerleader")),
    studentId: v.string(),
    fullNameThai: v.string(),
    fullNameEnglish: v.string(),
    nicknameThai: v.optional(v.string()),
    nicknameEnglish: v.optional(v.string()),
    sex: v.union(
      v.literal("Male"),
      v.literal("Female"),
      v.literal("Non-binary"),
      v.literal("Prefer not to say"),
    ),
    faculty: v.union(
      v.literal("คณะแพทยศาสตร์"),
      v.literal("คณะศิลปศาสตร์"),
      v.literal("วิทยาลัยแพทยศาสตร์นานาชาติจุฬาภรณ์"),
    ),
    phone: v.string(),
    email: v.string(),
    lineId: v.optional(v.string()),
    instagram: v.optional(v.string()),
    preferredContact: v.union(
      v.literal("Phone"),
      v.literal("LINE"),
      v.literal("Instagram"),
      v.literal("Email"),
    ),
    pdpaConsent: v.literal(true),
  },
  returns: v.object({
    sessionId: v.id("uploadSessions"),
    name: v.string(),
    performerType: v.union(v.literal("Katakorn"), v.literal("Cheerleader")),
  }),
  handler: async (ctx, args) => {
    const audit = await ctx.db.get("auditEvents", args.auditEventId);
    if (!audit || Date.now() - audit.createdAt > 30 * 60 * 1000) {
      throw new ConvexError("Registration session expired. Please refresh and try again");
    }
    if (audit.action !== "performer_registration_visit" || audit.successful) {
      throw new ConvexError("This registration session cannot be used");
    }

    const studentId = args.studentId.trim();
    const fullNameThai = args.fullNameThai.trim();
    const fullNameEnglish = args.fullNameEnglish.trim();
    const faculty = args.faculty.trim();
    const phone = normalizePhone(args.phone);
    const email = args.email.trim().toLowerCase();
    if (!/^\d{10}$/.test(studentId)) throw new ConvexError("Student ID must contain exactly 10 digits");
    if (!fullNameThai || !fullNameEnglish || !faculty) throw new ConvexError("Please complete all required personal information");
    if (!phone) throw new ConvexError("Please enter a valid 10-digit Thai phone number");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ConvexError("Please enter a valid email address");

    const registrations = await registrationsForStudent(ctx, studentId);
    if (registrations.length && !registrations.some(row => normalizePhone(row.phone ?? "") === phone)) {
      throw new ConvexError("The information does not match our registration record. Please contact staff");
    }
    const existing = await ctx.db
      .query("participants")
      .withIndex("by_studentId_and_sport", (q) => q.eq("studentId", studentId).eq("sport", args.performerType))
      .unique();
    const registrationData = {
      participantKind: "performer",
      performerType: args.performerType,
      fullNameThai,
      fullNameEnglish,
      nicknameThai: args.nicknameThai?.trim() || undefined,
      nicknameEnglish: args.nicknameEnglish?.trim() || undefined,
      sex: args.sex.trim(),
      faculty,
      phone,
      email,
      lineId: args.lineId?.trim() || undefined,
      instagram: args.instagram?.trim().replace(/^@/, "") || undefined,
      preferredContact: args.preferredContact.trim(),
      pdpaConsent: "consented",
      sport: args.performerType,
      category: "Performer",
      status: "incomplete",
      source: "self",
      updatedAt: Date.now(),
    } as const;

    let participantId;
    if (existing) {
      const isResumable = existing.participantKind === "performer" &&
        existing.status === "incomplete" &&
        normalizePhone(existing.phone ?? "") === phone;
      if (!isResumable) {
        throw new ConvexError("This Student ID is already registered. Please contact staff if you need to update your record");
      }
      await ctx.db.patch("participants", existing._id, registrationData);
      participantId = existing._id;
    } else {
      const lastOrderedParticipant = await ctx.db
        .query("participants")
        .withIndex("by_orderNumber")
        .order("desc")
        .first();
      participantId = await ctx.db.insert("participants", {
        ...registrationData,
        ...await existingDocuments(ctx, studentId),
        studentId,
        orderNumber: (lastOrderedParticipant?.orderNumber ?? 0) + 1,
      });
    }
    await ctx.db.patch("auditEvents", audit._id, {
      action: "performer_registration_started",
      participantId,
      attempts: audit.attempts + 1,
      successful: true,
    });
    const sessionId = await ctx.db.insert("uploadSessions", {
      participantId,
      studentId,
      auditEventId: audit._id,
      expiresAt: Date.now() + 30 * 60 * 1000,
      used: false,
    });
    return { sessionId, name: fullNameThai, performerType: args.performerType };
  },
});

export const verifyIdentity = mutation({
  args: {
    sport: v.optional(v.string()),
    studentId: v.string(),
    phone: v.string(),
    auditEventId: v.id("auditEvents"),
  },
  returns: v.object({ sessionId: v.id("uploadSessions"), name: v.string(), sport: v.string(), faculty: v.string(), phone: v.string(), profile: profileInput }),
  handler: async (ctx, args) => {
    const audit = await ctx.db.get("auditEvents", args.auditEventId);
    if (!audit || Date.now() - audit.createdAt > 30 * 60 * 1000) throw new ConvexError("Verification session expired");
    if (audit.attempts >= 5) throw new ConvexError("Too many attempts. Please contact staff");
    await ctx.db.patch("auditEvents", audit._id, { attempts: audit.attempts + 1 });

    const studentId = args.studentId.trim();
    if (!/^\d{10}$/.test(studentId)) {
      throw new ConvexError("Student ID must contain exactly 10 digits");
    }
    const registrations = await registrationsForStudent(ctx, studentId);
    const submittedPhone = normalizePhone(args.phone);
    const participant = submittedPhone === null ? undefined : registrations.find(row => normalizePhone(row.phone ?? "") === submittedPhone);
    if (!participant) {
      throw new ConvexError("The information does not match our registration record");
    }
    await ctx.db.patch("auditEvents", audit._id, { participantId: participant._id, successful: true });
    const sessionId = await ctx.db.insert("uploadSessions", {
      participantId: participant._id,
      studentId,
      auditEventId: audit._id,
      expiresAt: Date.now() + 15 * 60 * 1000,
      used: false,
    });
    return { sessionId, name: participant.fullNameThai, sport: [...new Set(registrations.map(row => row.sport))].join(", "), faculty: participant.faculty, phone: participant.phone ?? "", profile: {
      fullNameThai: participant.fullNameThai, fullNameEnglish: participant.fullNameEnglish, faculty: participant.faculty,
      nicknameThai: participant.nicknameThai, nicknameEnglish: participant.nicknameEnglish, sex: participant.sex,
      email: participant.email, lineId: participant.lineId, instagram: participant.instagram, preferredContact: participant.preferredContact,
    } };
  },
});

export const generateUploadUrl = mutation({
  args: { sessionId: v.id("uploadSessions") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get("uploadSessions", args.sessionId);
    if (!session || session.used || session.expiresAt < Date.now()) throw new ConvexError("Upload session expired");
    return await ctx.storage.generateUploadUrl();
  },
});

export const completeUpload = mutation({
  args: { profile: v.optional(profileInput), confirmed: v.optional(v.literal(true)), sessionId: v.id("uploadSessions"), profilePhotoId: v.id("_storage"), nationalIdImageId: v.id("_storage"), studentIdImageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get("uploadSessions", args.sessionId);
    if (!session || session.used || session.expiresAt < Date.now()) throw new ConvexError("Upload session expired");
    const participant = await ctx.db.get("participants", session.participantId);
    if (!participant) throw new ConvexError("Participant not found");
    if (session.studentId && session.studentId !== participant.studentId) throw new ConvexError("Registration changed. Please verify your identity again");
    const audit = await ctx.db.get("auditEvents", session.auditEventId);
    if (audit?.action !== "performer_registration_started" && (!args.profile || !args.confirmed)) {
      throw new ConvexError("Please complete and confirm your information before submitting");
    }
    if (args.profile) {
      if (!args.confirmed) throw new ConvexError("Please confirm your information");
      const profile = {
        ...args.profile,
        fullNameThai: args.profile.fullNameThai.trim(),
        fullNameEnglish: args.profile.fullNameEnglish.trim(),
        faculty: args.profile.faculty.trim(),
        email: args.profile.email?.trim().toLowerCase() || undefined,
      };
      if (!profile.fullNameThai || !profile.fullNameEnglish) throw new ConvexError("Thai and English names are required");
      if (!["คณะแพทยศาสตร์", "คณะศิลปศาสตร์", "วิทยาลัยแพทยศาสตร์นานาชาติจุฬาภรณ์"].includes(profile.faculty)) throw new ConvexError("Choose a supported faculty");
      if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) throw new ConvexError("Please enter a valid email address");
      for (const row of await registrationsForStudent(ctx, participant.studentId)) {
        await ctx.db.patch("participants", row._id, profile);
      }
    }
    await linkDocuments(ctx, participant, {
      profilePhotoId: args.profilePhotoId,
      nationalIdImageId: args.nationalIdImageId,
      studentIdImageId: args.studentIdImageId,
    });
    await ctx.db.patch("uploadSessions", session._id, { used: true });
    await ctx.db.patch("auditEvents", session.auditEventId, {
      action: participant.participantKind === "performer"
        ? "performer_registration_completed"
        : "self_upload_completed",
      successful: true,
    });
    return null;
  },
});
