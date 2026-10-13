import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { kitStatusReport } from "@/shared/firstAidKitStatus";

/** Status of every active first aid kit as JSON, for agents and scripts. Same data as the public tracking page. */
export async function GET() {
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const kits = await client.query(api.firstAidKits.publicStatus, {});
  return Response.json(kitStatusReport(kits), { headers: { "Cache-Control": "no-store" } });
}
