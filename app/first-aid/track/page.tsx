import type { Metadata } from "next";
import { FirstAidTracking } from "../../components/FirstAidTracking";

export const metadata: Metadata = {
  title: "Kit Tracking · Freshy HR",
  description: "Live location of Freshy Game first aid kits.",
};

export default function FirstAidTrackingPage() {
  return <FirstAidTracking />;
}
