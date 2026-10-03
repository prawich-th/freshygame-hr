"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { ArrowLeft, BriefcaseMedical, ClipboardPen, Radio } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Brand } from "./Brand";
import { UploadHeading } from "./self-upload/UploadLayout";
import { FacultyTag, formatTime } from "./FirstAidLog";
import { FirstAidContact } from "./FirstAidContact";
import { kitPath } from "./FirstAidKitLinks";

type Filter = "all" | "out" | "available";

const clock = (value: number) => new Date(value).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/** Public, read-only view of where every first aid kit is. Updates live. */
export function FirstAidTracking() {
  const [dayStart] = useState(startOfToday);
  const kits = useQuery(api.firstAidKits.publicTracking, { dayStart });
  const [filter, setFilter] = useState<Filter>("all");
  const out = kits?.filter(k => k.current).length ?? 0;
  const shown = (kits ?? []).filter(k => filter === "all" || (filter === "out") === !!k.current);

  return (
    <main className="self-upload-page">
      <header className="self-upload-page__header">
        <Brand />
        <Link className="text-link" href="/"><ArrowLeft size={16} />กลับหน้าหลัก</Link>
      </header>
      <div className="self-upload-page__layout">
        <aside className="upload-sidebar">
          <span className="upload-eyebrow">FIRST AID KITS</span>
          <h1>ติดตาม<br />กล่องปฐมพยาบาล</h1>
          <p>ดูว่ากล่องแต่ละใบอยู่กับกีฬาไหนตอนนี้ และวันนี้ผ่านกีฬาใดมาบ้าง ข้อมูลอัปเดตอัตโนมัติ</p>
          <ol className="upload-steps">
            <li><b>{kits ? kits.length - out : "–"}</b><div><strong>ว่าง</strong><span>Available</span></div></li>
            <li><b>{kits ? out : "–"}</b><div><strong>ถูกยืม</strong><span>Out with a sport</span></div></li>
          </ol>
          <div className="upload-sidebar__note"><Radio size={21} /><p>หน้านี้แสดงผลแบบสด ไม่ต้องรีเฟรช<br /><Link className="link-button" href="/first-aid"><ClipboardPen size={13} /> ยืมหรือคืนกล่อง</Link></p></div>
        </aside>
        <div className="upload-content">
          <UploadHeading title="กล่องอยู่ที่ไหนตอนนี้">Where each kit is right now, and the sports it has moved through today.</UploadHeading>
          <div className="kit-filter" role="group" aria-label="Filter kits">
            {([["all", "ทั้งหมด / All"], ["out", "ถูกยืม / Out"], ["available", "ว่าง / Available"]] as const).map(([value, label]) =>
              <button key={value} type="button" className={`button ${filter === value ? "button--primary" : "button--ghost"}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
          </div>
          {kits === undefined ? <p role="status">กำลังโหลด / Loading…</p> : kits.length === 0 ? <div className="notice notice--info">ยังไม่มีกล่องในระบบ / No kits have been set up yet.</div> : !shown.length ? <div className="notice notice--info">ไม่มีกล่องในหมวดนี้ / No kits match this filter.</div> :
            <div className="kit-grid">{shown.map(kit => <article key={kit.id} className={`kit-card ${kit.current ? "kit-card--out" : "kit-card--available"}`}>
              <span className="kit-card__head"><Link className="kit-card__link" href={kitPath(kit.number)} aria-label={`ยืมหรือคืนกล่องที่ ${kit.number} / Borrow or return kit ${kit.number}`}><strong>กล่องที่ {kit.number}</strong></Link><span className={`pill ${kit.current ? "pill--red" : "pill--green"}`}>{kit.current ? "ถูกยืม" : "ว่าง"}</span></span>
              {kit.label && <small>{kit.label}</small>}
              <span className="kit-card__where">{kit.current ? <><b>{kit.current.sport}</b><span>{kit.current.nickname || kit.current.name}{kit.current.faculty && <> <FacultyTag code={kit.current.faculty} /></>} · ตั้งแต่ {formatTime(kit.current.borrowedAt)}</span></> : <span>พร้อมให้ยืม / Available</span>}</span>
              <div className="kit-card__foot kit-timeline">
                <span>วันนี้ / Today</span>
                {kit.today.length ? <ol>{kit.today.map(move => <li key={move.borrowedAt} className={move.returnedAt === null ? "is-current" : ""}>
                  <BriefcaseMedical size={12} aria-hidden /><span><b>{move.sport}</b> · {move.nickname}{move.faculty && ` · ${move.faculty}`}</span><time>{clock(move.borrowedAt)}–{move.returnedAt === null ? "ตอนนี้" : clock(move.returnedAt)}</time>
                </li>)}</ol> : <em>ยังไม่มีการยืม / No movements yet</em>}
              </div>
            </article>)}</div>}
          <FirstAidContact />
        </div>
      </div>
    </main>
  );
}
