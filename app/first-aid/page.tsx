import type { Metadata } from "next";
import { FirstAidLog } from "../components/FirstAidLog";

export const metadata: Metadata = {
  title: "First Aid Kits · Freshy HR",
  description: "Borrow and return Freshy Game first aid kits.",
};

export default function FirstAidLogPage() {
  return <FirstAidLog />;
}
