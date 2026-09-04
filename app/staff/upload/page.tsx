import type { Metadata } from "next";
import { BoothUpload } from "../../components/BoothUpload";

export const metadata: Metadata = {
  title: "Registration Booth · Freshy HR",
  description: "Mobile document capture for registration staff.",
};

export default function StaffUploadPage() {
  return <BoothUpload />;
}
