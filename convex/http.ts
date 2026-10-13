import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();
auth.addHttpRoutes(http);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

/** Constant-time comparison so the token cannot be guessed one character at a time. */
function sameToken(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * JSON status of every active first aid kit, for agents and scripts.
 * Callers send `Authorization: Bearer <FIRST_AID_API_TOKEN>`; the endpoint is off until that env var is set.
 */
http.route({
  path: "/first-aid/kits",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const token = process.env.FIRST_AID_API_TOKEN;
    if (!token) return json({ error: "First aid kit API is not enabled" }, 503);
    const given = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
    if (!sameToken(given, token)) return json({ error: "Unauthorized" }, 401);

    const kits = await ctx.runQuery(api.firstAidKits.publicStatus, {});
    return json({
      generatedAt: new Date().toISOString(),
      total: kits.length,
      available: kits.filter(kit => !kit.current).length,
      checkedOut: kits.filter(kit => kit.current).length,
      kits: kits.map(kit => ({
        number: kit.number,
        label: kit.label,
        status: kit.current ? "checked_out" : "available",
        holder: kit.current ? {
          name: kit.current.name, nickname: kit.current.nickname, faculty: kit.current.faculty, phone: kit.current.phone,
          sport: kit.current.sport, borrowedAt: new Date(kit.current.borrowedAt).toISOString(),
        } : null,
      })),
    });
  }),
});

export default http;
