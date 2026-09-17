import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { Brand } from "../Brand";

const STEPS = [
  ["ยืนยันตัวตน", "Verify identity"],
  ["เลือกเอกสาร", "Choose documents"],
  ["ตรวจสอบและลงนาม", "Review & sign"],
  ["เสร็จเรียบร้อย", "Complete"],
] as const;

export function UploadLayout({ step, children, registration = false }: { step: number; children: ReactNode; registration?: boolean }) {
  const steps = registration ? [
    ["ตรวจสอบรหัสนักศึกษา", "Check Student ID"],
    ["ข้อมูลผู้แสดง", "Performer details"],
    ["เอกสารและลายเซ็น", "Documents & sign"],
    ["เสร็จเรียบร้อย", "Complete"],
  ] : STEPS;
  const content = useRef<HTMLDivElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current !== step) {
      content.current?.focus();
      content.current?.scrollIntoView({ block: "start" });
      previousStep.current = step;
    }
  }, [step]);

  return (
    <main className="self-upload-page">
      <header className="self-upload-page__header">
        <Brand />
        <Link className="text-link" href="/"><ArrowLeft size={16} />กลับหน้าหลัก</Link>
      </header>
      <div className="self-upload-page__layout">
        <aside className="upload-sidebar">
          <span className="upload-eyebrow">{registration ? "PERFORMER REGISTRATION" : "PARTICIPANT DOCUMENTS"}</span>
          <h1>{registration ? <>ลงทะเบียน<br />ทีมการแสดง</> : <>เตรียมให้พร้อม<br />ก่อนลงสนาม</>}</h1>
          <p>{registration ? "สำหรับ Katakorn, Cheerleader และสมาชิกขบวนพาเหรด ใช้ข้อมูลเดิมและเพิ่มเติมเฉพาะส่วนที่ยังขาด" : "ส่งเอกสารครั้งเดียว ใช้ได้กับทุกกีฬาและกิจกรรมที่คุณลงทะเบียน"}</p>
          <nav aria-label="ขั้นตอนการส่งเอกสาร / Upload progress">
            <ol className="upload-steps">
              {steps.map(([thai, english], index) => (
                <li key={english} aria-current={step === index + 1 ? "step" : undefined} className={step > index + 1 ? "is-complete" : ""}>
                  <b>{step > index + 1 ? <Check size={17} /> : String(index + 1).padStart(2, "0")}</b>
                  <div><strong>{thai}</strong><span>{english}</span></div>
                </li>
              ))}
            </ol>
          </nav>
          <div className="upload-sidebar__note"><ShieldCheck size={21} /><p>เตรียมรูปนักศึกษา บัตรประชาชน และบัตรนักศึกษาให้พร้อมก่อนเริ่ม</p></div>
        </aside>
        <div className="upload-content" ref={content} tabIndex={-1}>
          <div className="upload-content__step">ขั้นตอน {step} จาก 4 <span>{steps[step - 1][1]}</span></div>
          {children}
        </div>
      </div>
    </main>
  );
}

export function UploadHeading({ title, children }: { title: string; children: ReactNode }) {
  return <header className="upload-heading"><h2>{title}</h2><p>{children}</p></header>;
}

export function UploadError({ message }: { message: string }) {
  return message ? <div role="alert" className="notice notice--error">{message}</div> : null;
}
