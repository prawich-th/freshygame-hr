import type { Metadata } from "next";
import { SignatureOnly } from "../components/SignatureOnly";

export const metadata: Metadata = { title: "Sign your documents | Freshy HR", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function SignaturePage() { return <SignatureOnly />; }
