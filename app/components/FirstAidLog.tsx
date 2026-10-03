"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, ArrowRightLeft, BadgeCheck, BriefcaseMedical, Check, MapPin, PackageCheck, PackageOpen, Undo2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Brand } from "./Brand";
import { UploadError, UploadHeading } from "./self-upload/UploadLayout";
import { errorMessage } from "../lib/errors";

type Mode = "borrow" | "return" | "handover";
type Done = { mode: Mode; kit: number; sport?: string };

export function formatTime(value: number) {
  return new Date(value).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Public, account-free page for borrowing and returning first aid kits.
 * `kitNumber` comes from a kit's own link (e.g. a QR code on the box) and preselects it.
 */
export function FirstAidLog({ kitNumber }: { kitNumber?: number }) {
  const kits = useQuery(api.firstAidKits.publicStatus);
  const [kitId, setKitId] = useState<Id<"firstAidKits"> | null>(null);
  const [fromLink, setFromLink] = useState(kitNumber !== undefined);
  const [mode, setMode] = useState<Mode | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const kit = kitId ? kits?.find(k => k.id === kitId) : fromLink ? kits?.find(k => k.number === kitNumber) : undefined;
  const missingLinkedKit = fromLink && kits !== undefined && !kit;
  // An available kit goes straight to borrowing; a kit that is out asks what to do.
  const activeMode = mode ?? (kit && !kit.current ? "borrow" : null);

  function choose(id: Id<"firstAidKits">) { setKitId(id); setMode(null); setDone(null); }
  function reset() { setKitId(null); setFromLink(false); setMode(null); setDone(null); }

  return (
    <main className="self-upload-page">
      <header className="self-upload-page__header">
        <Brand />
        <Link className="text-link" href="/"><ArrowLeft size={16} />กลับหน้าหลัก</Link>
      </header>
      <div className="self-upload-page__layout">
        <aside className="upload-sidebar">
          <span className="upload-eyebrow">FIRST AID KITS</span>
          <h1>ยืม–คืน<br />กล่องปฐมพยาบาล</h1>
          <p>เลือกกล่องที่ต้องการ แล้วกรอกรหัสนักศึกษา ไม่ต้องเข้าสู่ระบบ ครั้งต่อไปใช้แค่รหัสนักศึกษาก็พอ</p>
          <ol className="upload-steps">
            <li><b>01</b><div><strong>เลือกกล่อง</strong><span>Choose a kit</span></div></li>
            <li><b>02</b><div><strong>ยืม คืน หรือรับต่อ</strong><span>Borrow, return, or take over</span></div></li>
            <li><b>03</b><div><strong>บันทึกเรียบร้อย</strong><span>Logged</span></div></li>
          </ol>
          <div className="upload-sidebar__note"><BriefcaseMedical size={21} /><p>หากกล่องถูกส่งต่อให้กีฬาถัดไปโดยตรง ให้ผู้รับเลือก “รับต่อ” เพื่อบันทึกการคืนและการยืมพร้อมกัน<br /><Link className="link-button" href="/first-aid/track"><MapPin size={13} /> ดูว่ากล่องอยู่ที่ไหน / Track kits</Link></p></div>
        </aside>
        <div className="upload-content">
          {done ? <FirstAidDone done={done} onReset={reset} /> : !kit ? <>
            {missingLinkedKit && <div className="notice notice--error" role="alert" style={{ marginBottom: 18 }}>ไม่พบกล่องที่ {kitNumber} หรือกล่องนี้เลิกใช้งานแล้ว กรุณาเลือกกล่องด้านล่าง / Kit {kitNumber} was not found or is retired. Choose a kit below.</div>}
            <UploadHeading title="เลือกกล่องปฐมพยาบาล">แตะกล่องที่ต้องการยืมหรือคืน<br />Tap the kit you are borrowing or returning.</UploadHeading>
            {kits === undefined ? <p role="status">กำลังโหลด / Loading…</p> : kits.length === 0 ? <div className="notice notice--info">ยังไม่มีกล่องในระบบ กรุณาติดต่อเจ้าหน้าที่ / No kits have been set up yet. Please contact staff.</div> :
              <div className="kit-grid">{kits.map(k => <button key={k.id} type="button" className={`kit-card ${k.current ? "kit-card--out" : "kit-card--available"}`} onClick={() => choose(k.id)}>
                <span className="kit-card__head"><strong>กล่องที่ {k.number}</strong><span className={`pill ${k.current ? "pill--red" : "pill--green"}`}>{k.current ? "ถูกยืม" : "ว่าง"}</span></span>
                {k.label && <small>{k.label}</small>}
                {k.current ? <span className="kit-card__where"><b>{k.current.sport}</b><span>{k.current.nickname || k.current.name} · {formatTime(k.current.borrowedAt)}</span></span> : <span className="kit-card__where"><span>พร้อมให้ยืม / Available</span></span>}
              </button>)}</div>}
          </> : <>
            <div className="upload-person"><BriefcaseMedical size={24} /><div><strong>กล่องที่ {kit.number}{kit.label ? ` · ${kit.label}` : ""}</strong><span>{kit.current ? `อยู่กับ ${kit.current.name} (${kit.current.nickname}) · ${kit.current.sport} · ตั้งแต่ ${formatTime(kit.current.borrowedAt)}` : "พร้อมให้ยืม / Available"}</span></div></div>
            {kit.current && !activeMode && <>
              <UploadHeading title="ต้องการทำอะไร?">เลือก “คืนกล่อง” เมื่อนำกล่องกลับมาคืน หรือ “รับต่อ” เมื่อรับกล่องต่อจากกีฬาก่อนหน้าโดยตรง</UploadHeading>
              <div className="kit-actions">
                <button type="button" className="kit-action" onClick={() => setMode("return")}><Undo2 size={22} /><strong>คืนกล่อง</strong><span>Return this kit</span></button>
                <button type="button" className="kit-action" onClick={() => setMode("handover")}><ArrowRightLeft size={22} /><strong>รับต่อ</strong><span>Take over for another sport</span></button>
              </div>
              <div className="upload-actions"><button type="button" className="button button--ghost" onClick={reset}>เลือกกล่องอื่น / Choose another kit</button></div>
            </>}
            {activeMode === "return" && <ReturnForm kitId={kit.id} onBack={() => setMode(null)} onDone={() => setDone({ mode: "return", kit: kit.number })} />}
            {(activeMode === "borrow" || activeMode === "handover") && <BorrowForm kitId={kit.id} handover={activeMode === "handover"} onBack={() => kit.current ? setMode(null) : reset()} onDone={sport => setDone({ mode: activeMode, kit: kit.number, sport })} />}
          </>}
        </div>
      </div>
    </main>
  );
}

function FirstAidDone({ done, onReset }: { done: Done; onReset: () => void }) {
  return <section className="success-panel">
    <div className="success-panel__check"><Check size={34} /></div>
    <h2>{done.mode === "return" ? `คืนกล่องที่ ${done.kit} เรียบร้อย` : `ยืมกล่องที่ ${done.kit} เรียบร้อย`}</h2>
    <p>{done.mode === "return" ? "Kit returned. Thank you!" : `Logged for ${done.sport}. Please return the kit when your event ends.`}</p>
    <button type="button" className="button button--ghost button--large" onClick={onReset}>บันทึกรายการอื่น / Log another kit</button>
  </section>;
}

function useKnownBorrower(studentId: string) {
  return useQuery(api.firstAidKits.knownBorrower, /^\d{10}$/.test(studentId) ? { studentId } : "skip");
}

function StudentIdField({ id, value, onChange, disabled }: { id: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <div className="field"><label htmlFor={id}>รหัสนักศึกษา / Student ID <span>*</span></label><input id={id} className="input" required inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} autoComplete="off" value={value} disabled={disabled} onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))} /></div>;
}

function BorrowForm({ kitId, handover, onBack, onDone }: { kitId: Id<"firstAidKits">; handover: boolean; onBack: () => void; onDone: (sport: string) => void }) {
  const checkOut = useMutation(api.firstAidKits.checkOut);
  const sports = useQuery(api.firstAidKits.sportOptions);
  const [studentId, setStudentId] = useState("");
  const known = useKnownBorrower(studentId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(""); const [nickname, setNickname] = useState(""); const [phone, setPhone] = useState("");
  const [sport, setSport] = useState(""); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  function changeStudentId(value: string) {
    setStudentId(value); setEditing(false); setName(""); setNickname(""); setPhone("");
  }
  // Blank fields are filled from earlier logs on the server, so the full phone number is never sent to the page.
  function editKnown() {
    if (!known) return;
    setEditing(true); setName(known.name); setNickname(known.nickname);
  }
  const lookingUp = /^\d{10}$/.test(studentId) && known === undefined;
  const showFields = studentId.length === 10 && !lookingUp && (!known || editing);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await checkOut({ kitId, studentId, sport, note: note || undefined, handover, name: name || undefined, nickname: nickname || undefined, phone: phone || undefined });
      onDone(sport.trim());
    } catch (caught) { setError(errorMessage(caught, handover ? "Take over this kit" : "Borrow this kit")); }
    finally { setBusy(false); }
  }

  return <>
    <UploadHeading title={handover ? "รับกล่องต่อ" : "ยืมกล่อง"}>{handover ? "บันทึกการคืนของผู้ยืมเดิมและการยืมของคุณในครั้งเดียว" : "กรอกรหัสนักศึกษา หากเคยยืมแล้ว ระบบจะดึงข้อมูลเดิมให้"}<br />{handover ? "Records the previous borrower's return and your checkout together." : "Enter your Student ID. Returning borrowers are filled in automatically."}</UploadHeading>
    <form className="upload-form" onSubmit={e => void submit(e)} aria-busy={busy}>
      <fieldset className="upload-section" disabled={busy}>
        <legend>ผู้ยืม / Borrower</legend>
        <StudentIdField id="kit-student-id" value={studentId} onChange={changeStudentId} />
        {lookingUp && <p role="status" className="upload-help">กำลังตรวจสอบ / Checking…</p>}
        {known && !editing && <div className="upload-person"><BadgeCheck size={24} /><div><strong>ยินดีต้อนรับกลับ {known.name} ({known.nickname})</strong><span>เบอร์โทร {known.phoneHint} · <button type="button" className="link-button" onClick={editKnown}>แก้ไขข้อมูล / Update details</button></span></div></div>}
        {showFields && <div className="form-grid">
          <div className="field field--wide"><label htmlFor="kit-name">ชื่อ - สกุล / Full name <span>*</span></label><input id="kit-name" className="input" required={!known} maxLength={100} value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="field"><label htmlFor="kit-nickname">ชื่อเล่น / Nickname <span>*</span></label><input id="kit-nickname" className="input" required={!known} maxLength={50} value={nickname} onChange={e => setNickname(e.target.value)} /></div>
          <div className="field"><label htmlFor="kit-phone">เบอร์โทร / Phone {!known && <span>*</span>}</label><input id="kit-phone" className="input" type="tel" inputMode="tel" required={!known} maxLength={15} placeholder={known ? `เว้นว่างเพื่อใช้ ${known.phoneHint}` : "0812345678"} value={phone} onChange={e => setPhone(e.target.value)} /></div>
        </div>}
      </fieldset>
      <fieldset className="upload-section" disabled={busy}>
        <legend>ใช้สำหรับ / Used for</legend>
        <div className="field"><label htmlFor="kit-sport">สำหรับกีฬา / Sport or activity <span>*</span></label><input id="kit-sport" className="input" required maxLength={100} list="kit-sport-options" placeholder="เช่น ฟุตบอล / Football" value={sport} onChange={e => setSport(e.target.value)} /><datalist id="kit-sport-options">{sports?.map(s => <option key={s} value={s} />)}</datalist></div>
        <div className="field"><label htmlFor="kit-note">หมายเหตุ / Note</label><input id="kit-note" className="input" maxLength={300} placeholder="ไม่บังคับ / Optional" value={note} onChange={e => setNote(e.target.value)} /></div>
      </fieldset>
      <UploadError message={error} />
      <div className="upload-actions">
        <button type="button" className="button button--ghost" disabled={busy} onClick={onBack}>ย้อนกลับ / Back</button>
        <button className="button button--primary" disabled={busy || studentId.length !== 10 || lookingUp}>{busy ? "กำลังบันทึก / Saving…" : <>{handover ? <ArrowRightLeft size={17} /> : <PackageOpen size={17} />} {handover ? "รับต่อ / Take over" : "ยืมกล่อง / Borrow"}</>}</button>
      </div>
    </form>
  </>;
}

function ReturnForm({ kitId, onBack, onDone }: { kitId: Id<"firstAidKits">; onBack: () => void; onDone: () => void }) {
  const checkIn = useMutation(api.firstAidKits.checkIn);
  const [studentId, setStudentId] = useState("");
  const known = useKnownBorrower(studentId);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const lookingUp = /^\d{10}$/.test(studentId) && known === undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try { await checkIn({ kitId, studentId, name: name || undefined }); onDone(); }
    catch (caught) { setError(errorMessage(caught, "Return this kit")); }
    finally { setBusy(false); }
  }

  return <>
    <UploadHeading title="คืนกล่อง">กรอกรหัสนักศึกษาของผู้ที่นำกล่องมาคืน<br />Enter the Student ID of the person returning the kit.</UploadHeading>
    <form className="upload-form" onSubmit={e => void submit(e)} aria-busy={busy}>
      <fieldset className="upload-section" disabled={busy}>
        <legend>ผู้คืน / Returned by</legend>
        <StudentIdField id="kit-return-student-id" value={studentId} onChange={setStudentId} />
        {known && <div className="upload-person"><BadgeCheck size={24} /><div><strong>{known.name} ({known.nickname})</strong><span>{studentId}</span></div></div>}
        {studentId.length === 10 && known === null && <div className="field"><label htmlFor="kit-return-name">ชื่อ - สกุล / Full name <span>*</span></label><input id="kit-return-name" className="input" required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></div>}
      </fieldset>
      <UploadError message={error} />
      <div className="upload-actions">
        <button type="button" className="button button--ghost" disabled={busy} onClick={onBack}>ย้อนกลับ / Back</button>
        <button className="button button--primary" disabled={busy || studentId.length !== 10 || lookingUp}>{busy ? "กำลังบันทึก / Saving…" : <><PackageCheck size={17} /> คืนกล่อง / Return</>}</button>
      </div>
    </form>
  </>;
}
