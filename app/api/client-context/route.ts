import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export async function POST(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? undefined;
  let purpose: "document_upload" | "performer_registration" | undefined;
  try {
    const body: unknown = await request.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "purpose" in body &&
      body.purpose === "performer_registration"
    ) {
      purpose = "performer_registration";
    }
  } catch {
    // Existing document-upload clients send an empty body.
  }
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const auditEventId = await client.mutation(api.publicIntake.recordVisit, {
    ipAddress,
    userAgent,
    purpose,
  });
  return Response.json({ auditEventId }, { headers: { "Cache-Control": "no-store" } });
}
