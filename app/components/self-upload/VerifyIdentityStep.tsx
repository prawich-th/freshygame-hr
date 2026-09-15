import { ArrowRight, LockKeyhole } from "lucide-react";
import { UploadError, UploadHeading } from "./UploadLayout";
import type { UploadFlow } from "./useSelfUpload";

export function VerifyIdentityStep({ flow }: { flow: UploadFlow }) {
  return <>
    <UploadHeading title="ยืนยันตัวตนของคุณ">กรอกรหัสนักศึกษาและเบอร์โทรที่ใช้ลงทะเบียน<br />Enter your Student ID and full registered phone number.</UploadHeading>
    <form onSubmit={flow.handleVerify} className="upload-form" aria-busy={flow.busy}>
      <fieldset disabled={flow.busy} className="upload-section">
        <legend>ข้อมูลลงทะเบียน / Registration details</legend>
        <div className="field"><label htmlFor="verify-student-id">รหัสนักศึกษา / Student ID *</label><input id="verify-student-id" className="input" name="studentId" required inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} placeholder="6909680123" aria-describedby="student-id-help" /><small id="student-id-help">รหัสนักศึกษา 10 หลัก / 10-digit Student ID</small></div>
        <div className="field"><label htmlFor="verify-phone">เบอร์โทรที่ลงทะเบียน / Registered phone *</label><input id="verify-phone" className="input" name="phone" required type="tel" inputMode="tel" autoComplete="tel" placeholder="081-234-5678" /></div>
      </fieldset>
      <div className="upload-privacy"><LockKeyhole size={17} /><p>ระบบบันทึก IP และข้อมูลเบราว์เซอร์เพื่อปกป้องข้อมูลของคุณ<br />Your IP address and browser details are recorded to protect your data.</p></div>
      <UploadError message={flow.error} />
      <div className="upload-actions"><button className="button button--primary" disabled={flow.busy || !flow.auditId}>{flow.busy ? "กำลังตรวจสอบ / Verifying…" : <>ตรวจสอบข้อมูล / Verify <ArrowRight size={17} /></>}</button></div>
    </form>
  </>;
}
