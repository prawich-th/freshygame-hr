import { defineApp } from "convex/server";
import { v } from "convex/values";

export default defineApp({
  env: {
    STAFF_INVITE_CODE: v.optional(v.string()),
  },
});
