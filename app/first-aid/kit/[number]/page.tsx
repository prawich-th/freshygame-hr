import type { Metadata } from "next";
import { FirstAidLog } from "../../../components/FirstAidLog";

export async function generateMetadata({ params }: PageProps<"/first-aid/kit/[number]">): Promise<Metadata> {
  const { number } = await params;
  return { title: `Kit ${number} · First Aid Kits · Freshy HR`, description: `Borrow or return first aid kit ${number}.` };
}

/** Permanent per-kit link, meant for the QR code label on each box. */
export default async function FirstAidKitPage({ params }: PageProps<"/first-aid/kit/[number]">) {
  const { number } = await params;
  const kitNumber = /^\d{1,4}$/.test(number) ? Number(number) : -1;
  return <FirstAidLog key={kitNumber} kitNumber={kitNumber} />;
}
