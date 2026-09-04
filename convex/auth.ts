import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { env } from "./_generated/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = String(params.email ?? "").trim().toLowerCase();
        if (!email) throw new Error("Email is required");

        const name = String(params.name ?? "").trim();
        if (params.flow !== "signUp") {
          return { email, name, role: "registrar" as const, active: true };
        }

        const inviteCode = String(params.inviteCode ?? "");

        if (!name) throw new Error("Name is required");
        if (!env.STAFF_INVITE_CODE) {
          throw new Error("Staff registration has not been configured");
        }
        if (inviteCode !== env.STAFF_INVITE_CODE) {
          throw new Error("Invalid staff invitation code");
        }

        return { email, name, role: "registrar" as const, active: true };
      },
      validatePasswordRequirements(password) {
        if (
          password.length < 10 ||
          !/[A-Z]/.test(password) ||
          !/[a-z]/.test(password) ||
          !/[0-9]/.test(password)
        ) {
          throw new Error(
            "Password must be at least 10 characters and include upper-case, lower-case, and a number",
          );
        }
      },
    }),
  ],
});
