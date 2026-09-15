import { ArrowRight, BadgeCheck } from "lucide-react";
import { DocumentUploadFields } from "../DocumentUploadFields";
import { ProfilePhotoGuide } from "../ProfilePhotoGuide";
import { UploadError, UploadHeading } from "./UploadLayout";
import type { UploadFlow } from "./useSelfUpload";

export function ChooseDocumentsStep({ flow }: { flow: UploadFlow }) {
  const { verified } = flow;
  if (!verified) return null;
  return <>
    <UploadHeading title="เลือกเอกสารของคุณ">เพิ่มรูปที่ยังขาดหรือเปลี่ยนรูปที่ต้องแก้ไข รูปเดิมที่ถูกต้องใช้ต่อได้<br />Add missing images or replace those needing correction. Keep any existing images that are already correct.</UploadHeading>
    <div className="upload-person"><BadgeCheck size={24} /><div><strong>{verified.name || "กรุณากรอกข้อมูลให้ครบ / Incomplete profile"}</strong><span>{verified.sport} · {verified.faculty}</span></div></div>
    <form className="upload-form" onSubmit={flow.reviewDocuments}>
      <ProfilePhotoGuide />
      <DocumentUploadFields {...flow.documents} existingUrls={verified.documentUrls} corrections={verified.correctionRequests} disabled={flow.busy} />
      <p className="upload-help">รูปใหม่จะใช้กับทุกการลงทะเบียนของคุณ สำเนาบัตรทั้งสองใบจะมีคำรับรองและลายเซ็นใน PDF<br />New images apply to all your registrations. Both ID copies will include your certification and signature in the PDF.</p>
      <UploadError message={flow.error} />
      <div className="upload-actions"><button className="button button--primary" disabled={flow.busy}>ตรวจสอบข้อมูล / Review <ArrowRight size={17} /></button></div>
    </form>
  </>;
}
