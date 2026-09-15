"use client";

import { CorrectionScope, CorrectionSummary } from "./FieldCorrections";
import Link from "next/link";
import { Check, ShieldCheck } from "lucide-react";
import { ChooseDocumentsStep } from "./self-upload/ChooseDocumentsStep";
import { ReviewInformationStep } from "./self-upload/ReviewInformationStep";
import { UploadLayout } from "./self-upload/UploadLayout";
import { VerifyIdentityStep } from "./self-upload/VerifyIdentityStep";
import { useSelfUpload } from "./self-upload/useSelfUpload";

export function SelfUpload() {
  const flow = useSelfUpload();
  return (
    <CorrectionScope requests={flow.verified?.correctionRequests ?? []}>
    <UploadLayout step={flow.step}>
      {flow.step !== 4 && <CorrectionSummary requests={flow.verified?.correctionRequests ?? []} />}
      {flow.step === 1 && <VerifyIdentityStep flow={flow} />}
      {flow.step === 2 && <ChooseDocumentsStep flow={flow} />}
      {flow.step === 3 && <ReviewInformationStep flow={flow} />}
      {flow.step === 4 && <UploadComplete />}
    </UploadLayout>
    </CorrectionScope>
  );
}

function UploadComplete() {
  return (
    <section className="success-panel">
      <div className="success-panel__check"><Check size={34} /></div>
      <h2>ส่งเอกสารเรียบร้อยแล้ว</h2>
      <p>เจ้าหน้าที่จะตรวจสอบเอกสารของคุณ คุณสามารถปิดหน้านี้ได้<br />Your documents are waiting for staff review. You can safely close this page.</p>
      <div className="notice notice--success"><ShieldCheck size={16} /> ข้อมูลของคุณถูกส่งอย่างปลอดภัยแล้ว</div>
      <Link href="/" className="button button--ghost button--large">กลับหน้าหลัก / Back to home</Link>
    </section>
  );
}
