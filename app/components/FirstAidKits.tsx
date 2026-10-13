"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { BriefcaseMedical, Download, ExternalLink, MapPin, PackageCheck, PackageOpen, PackageX, Pencil, Trash2, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { errorMessage } from "../lib/errors";
import { FacultyTag, formatTime } from "./FirstAidLog";
import { FACULTIES } from "@/shared/faculties";
import { downloadFirstAidCsv } from "../lib/firstAidCsv";
import { FirstAidKitLinks } from "./FirstAidKitLinks";
import { FirstAidTreatments } from "./FirstAidTreatments";
import { Pager, useCursorPages } from "./Pager";

type Loan = FunctionReturnType<typeof api.firstAidKits.log>["page"][number];

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function toLocalInput(value: number | null) {
  if (value === null) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export type FirstAidSection = "overview" | "log" | "treatments" | "kits";
type Kit = FunctionReturnType<typeof api.firstAidKits.overview>[number];

const SECTIONS: { id: FirstAidSection; label: string; href: string }[] = [
  { id: "overview", label: "Where kits are", href: "/staff/first-aid" },
  { id: "log", label: "Borrow & return log", href: "/staff/first-aid/log" },
  { id: "treatments", label: "First aid given", href: "/staff/first-aid/treatments" },
  { id: "kits", label: "Kits & QR codes", href: "/staff/first-aid/kits" },
];

/** Staff first aid workspace, split into subpages: kit locations, the log, first aid given, and kit setup. */
export function FirstAidKits({ role, section }: { role: "admin" | "registrar" | "viewer" | "co-sport"; section: FirstAidSection }) {
  const [dayStart] = useState(startOfToday);
  const kits = useQuery(api.firstAidKits.overview, { dayStart });
  const active = useMemo(() => (kits ?? []).filter(k => k.active), [kits]);
  const canEdit = role === "admin" || role === "registrar";

  return <>
    <nav className="kit-filter" aria-label="First aid sections">
      {SECTIONS.map(s => <Link key={s.id} href={s.href} className={`button ${section === s.id ? "button--primary" : "button--ghost"}`} aria-current={section === s.id ? "page" : undefined}>{s.label}</Link>)}
    </nav>
    {section === "overview" && <KitOverview kits={kits} active={active} canEdit={canEdit} isAdmin={role === "admin"} />}
    {section === "log" && <LogPanel kits={kits ?? []} canEdit={canEdit} isAdmin={role === "admin"} />}
    {section === "treatments" && <FirstAidTreatments kits={kits ?? []} isAdmin={role === "admin"} />}
    {section === "kits" && <>
      {kits === undefined ? <p className="empty-state" role="status">Loading kits…</p> : active.length > 0 ? <FirstAidKitLinks kits={active} /> : <p className="empty-state">No first aid kits yet.{role === "admin" ? " Add kits below." : " Ask an administrator to add them."}</p>}
      {role === "admin" && kits && <ManageKits kits={kits} />}
    </>}
  </>;
}

function KitOverview({ kits, active, canEdit, isAdmin }: { kits: Kit[] | undefined; active: Kit[]; canEdit: boolean; isAdmin: boolean }) {
  const checkIn = useMutation(api.firstAidKits.checkIn);
  const setMissing = useMutation(api.firstAidKits.setMissing);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const missing = active.filter(k => k.missing);
  const out = active.filter(k => !k.missing && k.current);
  const available = active.filter(k => !k.missing && !k.current);
  const today = active.reduce((sum, k) => sum + k.loansToday, 0);

  async function run(action: () => Promise<unknown>, label: string) {
    setBusy(true); setError("");
    try { await action(); }
    catch (caught) { setError(errorMessage(caught, label)); }
    finally { setBusy(false); }
  }
  function reportMissing(kit: Kit) {
    const note = window.prompt(`Mark kit ${kit.number} as missing?\nWhere was it last seen? (optional)`, "");
    if (note === null) return;
    void run(() => setMissing({ kitId: kit.id, missing: true, note: note || undefined }), "Mark the kit missing");
  }
  const actions = { busy, canEdit, onReturned: (kit: Kit) => void run(() => checkIn({ kitId: kit.id, studentId: kit.current!.studentId }), "Record the return"), onMissing: reportMissing, onFound: (kit: Kit) => void run(() => setMissing({ kitId: kit.id, missing: false }), "Mark the kit found") };

  return <>
    <div className="stats-grid">
      <Stat label="Out now" value={kits && out.length} icon={PackageOpen} />
      <Stat label="Available" value={kits && available.length} icon={PackageCheck} />
      <Stat label="Missing" value={kits && missing.length} icon={PackageX} />
      <Stat label="Checkouts today" value={kits && today} icon={BriefcaseMedical} />
    </div>
    {error && <div role="alert" className="notice notice--error" style={{ marginBottom: 16 }}>{error}</div>}
    <div className="kit-filter">
      <Link className="button button--soft" href="/first-aid" target="_blank"><ExternalLink size={14} /> Public logging page</Link>
      <Link className="button button--soft" href="/first-aid/track" target="_blank"><MapPin size={14} /> Public tracking page</Link>
    </div>
    {kits === undefined ? <p className="empty-state" role="status">Loading kits…</p> : !active.length ? <p className="empty-state">No first aid kits yet.{isAdmin ? <> <Link href="/staff/first-aid/kits">Add kits</Link>.</> : " Ask an administrator to add them."}</p> : <>
      {missing.length > 0 && <KitSection title="Missing" kits={missing} {...actions} />}
      <KitSection title="Out now" kits={out} empty="No kits are out right now." {...actions} />
      <KitSection title="Available" kits={available} empty="Every kit is out or missing." {...actions} />
    </>}
  </>;
}

type KitActions = { busy: boolean; canEdit: boolean; onReturned: (kit: Kit) => void; onMissing: (kit: Kit) => void; onFound: (kit: Kit) => void };

function KitSection({ title, kits, empty, ...actions }: { title: string; kits: Kit[]; empty?: string } & KitActions) {
  return <section className="panel" style={{ marginBottom: 20 }}>
    <div className="panel__head"><h2>{title} · {kits.length}</h2></div>
    {kits.length ? <div className="kit-grid kit-grid--staff">{kits.map(kit => <KitCard key={kit.id} kit={kit} {...actions} />)}</div> : <p className="empty-state">{empty}</p>}
  </section>;
}

function KitCard({ kit, busy, canEdit, onReturned, onMissing, onFound }: { kit: Kit } & KitActions) {
  const state = kit.missing ? "missing" : kit.current ? "out" : "available";
  const holder = kit.current ?? (kit.missing ? kit.lastReturned : null);
  return <article className={`kit-card kit-card--${state}`}>
    <span className="kit-card__head"><strong>Kit {kit.number}</strong><span className={`pill ${state === "available" ? "pill--green" : "pill--red"}`}>{state === "missing" ? "MISSING" : state === "out" ? "OUT" : "AVAILABLE"}</span></span>
    {kit.label && <small>{kit.label}</small>}
    {kit.missing && <span className="kit-card__where">
      <b>Missing since {formatTime(kit.missing.since)}</b>
      {kit.missing.note && <span>{kit.missing.note}</span>}
      {kit.missing.reportedByName && <span>Reported by {kit.missing.reportedByName}</span>}
    </span>}
    {holder ? <span className="kit-card__where">
      {kit.missing ? <span>{kit.current ? "Last borrowed by" : `Last returned ${formatTime(holder.returnedAt!)} by`}</span> : <b>{holder.sport}</b>}
      <span>{holder.borrowerName} ({holder.nickname}){holder.faculty && <> <FacultyTag code={holder.faculty} /></>} · {holder.studentId}{kit.missing && ` · ${holder.sport}`}</span>
      <span><a href={`tel:${holder.phone}`}>{holder.phone}</a> · since {formatTime(holder.borrowedAt)}</span>
    </span> : !kit.missing && <span className="kit-card__where"><span>{kit.lastReturned ? `Last: ${kit.lastReturned.sport} · returned ${formatTime(kit.lastReturned.returnedAt!)}` : "Not used yet"}</span>{kit.lastReturned?.returnPhotoUrl && <ReturnPhoto url={kit.lastReturned.returnPhotoUrl} kitNumber={kit.number} />}</span>}
    <span className="kit-card__foot"><span>{kit.loansToday} checkout{kit.loansToday === 1 ? "" : "s"} today</span>{canEdit && <span className="kit-card__actions">
      {kit.missing ? <button type="button" className="button button--soft" disabled={busy} onClick={() => onFound(kit)}>Mark found</button> : <>
        {kit.current && <button type="button" className="button button--soft" disabled={busy} onClick={() => onReturned(kit)}>Mark returned</button>}
        <button type="button" className="button button--ghost" disabled={busy} onClick={() => onMissing(kit)}>Mark missing</button>
      </>}
    </span>}</span>
  </article>;
}

/** Thumbnail of the photo taken when the kit came back; opens full size in a new tab. */
function ReturnPhoto({ url, kitNumber, large }: { url: string; kitNumber: number; large?: boolean }) {
  return <a className={`kit-return-photo${large ? " kit-return-photo--large" : ""}`} href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
    <img src={url} alt={`Kit ${kitNumber} when it was returned`} loading="lazy" />
  </a>;
}

function Stat({ label, value, icon: Icon }: { label: string; value?: number; icon: typeof BriefcaseMedical }) {
  return <article className="stat-card"><div><span>{label}</span><strong>{value ?? "—"}</strong></div><span className="stat-card__icon"><Icon size={17} /></span></article>;
}

const LOG_PAGE_SIZE = 25;

function LogPanel({ kits, canEdit, isAdmin }: { kits: Kit[]; canEdit: boolean; isAdmin: boolean }) {
  const convex = useConvex();
  const [kitFilter, setKitFilter] = useState<Id<"firstAidKits"> | "">("");
  const pages = useCursorPages();
  const page = useQuery(api.firstAidKits.log, { ...(kitFilter ? { kitId: kitFilter } : {}), paginationOpts: { cursor: pages.cursor, numItems: LOG_PAGE_SIZE } });
  const results = page?.page ?? [];
  const [editing, setEditing] = useState<Loan | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  async function exportCsv() {
    setExporting(true); setExportError("");
    try {
      const rows: Loan[] = [];
      let cursor: string | null = null;
      let isDone = false;
      while (!isDone) {
        const page: FunctionReturnType<typeof api.firstAidKits.log> = await convex.query(api.firstAidKits.log, { ...(kitFilter ? { kitId: kitFilter } : {}), paginationOpts: { cursor, numItems: 200 } });
        rows.push(...page.page); cursor = page.continueCursor; isDone = page.isDone;
      }
      downloadFirstAidCsv(rows);
    } catch (caught) { setExportError(errorMessage(caught, "Export the first aid log")); }
    finally { setExporting(false); }
  }
  return <section className="panel" style={{ marginBottom: 20 }}>
    <div className="panel__head"><h2>Borrow & return log</h2><div className="filters">
      <select className="select" aria-label="Filter by kit" value={kitFilter} onChange={e => { setKitFilter(e.target.value as Id<"firstAidKits"> | ""); pages.reset(); }}><option value="">All kits</option>{kits.map(k => <option key={k.id} value={k.id}>Kit {k.number}{k.label ? ` · ${k.label}` : ""}</option>)}</select>
      <button className="button button--soft" disabled={exporting} onClick={() => void exportCsv()}><Download size={14} />{exporting ? "Exporting…" : "Export CSV"}</button>
    </div></div>
    {exportError && <div role="alert" className="notice notice--error bulk-export-notice">{exportError}</div>}
    <div style={{ overflowX: "auto" }}><table className="data-table kit-log">
      <thead><tr><th>วันที่ยืม · Borrowed</th><th>วันที่คืน · Returned</th><th>ชื่อ - สกุล · Name</th><th>คณะ · Faculty</th><th>รหัสนักศึกษา · Student ID</th><th>เบอร์โทร · Phone</th><th>สำหรับกีฬา · Sport</th><th>กล่องที่ · Kit</th>{canEdit && <th aria-label="Actions" />}</tr></thead>
      <tbody>{results.map(row => <tr key={row.id} onClick={canEdit ? () => setEditing(row) : undefined} style={canEdit ? undefined : { cursor: "default" }}>
        <td>{formatTime(row.borrowedAt)}</td>
        <td>{row.returnedAt === null ? <span className="pill pill--red">OUT</span> : <>{formatTime(row.returnedAt)}{row.returnerStudentId && row.returnerStudentId !== row.studentId && <><br /><span className="kit-log__muted">by {row.returnerName}</span></>}{row.returnPhotoUrl && <ReturnPhoto url={row.returnPhotoUrl} kitNumber={row.kitNumber} />}</>}</td>
        <td><strong>{row.borrowerName}</strong><br /><span className="kit-log__muted">{row.nickname}</span></td>
        <td>{row.faculty ? <FacultyTag code={row.faculty} /> : "—"}</td>
        <td>{row.studentId}</td>
        <td>{row.phone}</td>
        <td>{row.sport}{row.note && <><br /><span className="kit-log__muted">{row.note}</span></>}</td>
        <td><strong>{row.kitNumber}</strong></td>
        {canEdit && <td><Pencil size={13} aria-label={`Edit entry for kit ${row.kitNumber}`} /></td>}
      </tr>)}
      {page === undefined ? <tr><td className="empty-state" colSpan={9} role="status">Loading…</td></tr> : !results.length && <tr><td className="empty-state" colSpan={9}>No kit activity logged yet.</td></tr>}</tbody>
    </table></div>
    <Pager page={pages.page} hasNext={!!page && !page.isDone} loading={page === undefined} onPrevious={pages.previous} onNext={() => page && pages.next(page.continueCursor)} />
    {editing && <EditLoanDrawer loan={editing} isAdmin={isAdmin} onClose={() => setEditing(null)} />}
  </section>;
}

function ManageKits({ kits }: { kits: Kit[] }) {
  const addKits = useMutation(api.firstAidKits.addKits);
  const updateKit = useMutation(api.firstAidKits.updateKit);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  async function run(action: () => Promise<string>, label: string) {
    setBusy(true); setMessage("");
    try { setMessage(await action()); setFailed(false); }
    catch (caught) { setMessage(errorMessage(caught, label)); setFailed(true); }
    finally { setBusy(false); }
  }
  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    void run(async () => {
      const numbers = await addKits({ count: Number(data.get("count")), label: String(data.get("label") ?? "") || undefined });
      form.reset();
      return `Added kit${numbers.length === 1 ? "" : "s"} ${numbers.join(", ")}.`;
    }, "Add first aid kits");
  }
  return <section className="content-card sport-catalog">
    <h2>Manage kits</h2>
    <p>Kits are numbered automatically. Retired kits stay in the log but are hidden from the logging page.</p>
    {message && <div role={failed ? "alert" : "status"} className={`notice notice--${failed ? "error" : "success"}`}>{message}</div>}
    <form className="sport-catalog__event" onSubmit={add}>
      <label className="field">Number of kits<input className="input" name="count" type="number" min={1} max={50} defaultValue={1} required disabled={busy} /></label>
      <label className="field">Label (optional)<input className="input" name="label" maxLength={60} placeholder="e.g. Large kit" disabled={busy} /></label>
      <button className="button button--primary" disabled={busy}>Add kits</button>
    </form>
    {kits.map(kit => <form key={`${kit.id}:${kit.label}:${kit.active}`} className="sport-catalog__event" onSubmit={e => {
      e.preventDefault();
      const label = String(new FormData(e.currentTarget).get("label") ?? "");
      void run(async () => { await updateKit({ kitId: kit.id, label, active: kit.active }); return `Saved kit ${kit.number}.`; }, "Save kit");
    }}>
      <label className="field">Kit {kit.number}{!kit.active && " (retired)"}<input className="input" name="label" maxLength={60} defaultValue={kit.label} placeholder="Label" disabled={busy} /></label>
      <button className="button button--soft" disabled={busy}>Save</button>
      <button type="button" className={`button ${kit.active ? "button--danger" : "button--soft"}`} disabled={busy} onClick={() => void run(async () => { await updateKit({ kitId: kit.id, label: kit.label, active: !kit.active }); return `Kit ${kit.number} ${kit.active ? "retired" : "back in service"}.`; }, "Update kit")}>{kit.active ? "Retire" : "Restore"}</button>
    </form>)}
  </section>;
}

function EditLoanDrawer({ loan, isAdmin, onClose }: { loan: Loan; isAdmin: boolean; onClose: () => void }) {
  const update = useMutation(api.firstAidKits.updateLoan);
  const remove = useMutation(api.firstAidKits.deleteLoan);
  const [returned, setReturned] = useState(loan.returnedAt !== null);
  const [openedAt] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "");
    setBusy(true); setError("");
    try {
      await update({
        loanId: loan.id, borrowerName: value("borrowerName"), nickname: value("nickname"), phone: value("phone"), faculty: value("faculty") as (typeof FACULTIES)[number]["code"], studentId: value("studentId"),
        sport: value("sport"), note: value("note") || undefined,
        borrowedAt: new Date(value("borrowedAt")).getTime(), returnedAt: returned ? new Date(value("returnedAt")).getTime() : null,
      });
      onClose();
    } catch (caught) { setError(errorMessage(caught, "Correct the log entry")); }
    finally { setBusy(false); }
  }
  async function destroy() {
    if (!window.confirm(`Delete this log entry for kit ${loan.kitNumber}? This cannot be undone.`)) return;
    setBusy(true); setError("");
    try { await remove({ loanId: loan.id }); onClose(); }
    catch (caught) { setError(errorMessage(caught, "Delete the log entry")); setBusy(false); }
  }
  return <><div className="drawer-backdrop" onClick={busy ? undefined : onClose} /><aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="edit-loan-title">
    <div className="drawer__head"><h2 id="edit-loan-title">Kit {loan.kitNumber} log entry</h2><button disabled={busy} onClick={onClose} aria-label="Close"><X size={17} /></button></div>
    <form className="participant-edit" onSubmit={e => void save(e)}><fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
      <div className="form-grid">
        <div className="field field--wide"><label htmlFor="loan-name">ชื่อ - สกุล / Full name</label><input id="loan-name" className="input" name="borrowerName" required maxLength={100} defaultValue={loan.borrowerName} /></div>
        <div className="field"><label htmlFor="loan-nickname">Nickname</label><input id="loan-nickname" className="input" name="nickname" required maxLength={50} defaultValue={loan.nickname} /></div>
        <div className="field"><label htmlFor="loan-phone">Phone</label><input id="loan-phone" className="input" name="phone" type="tel" required maxLength={15} defaultValue={loan.phone} /></div>
        <div className="field"><label htmlFor="loan-faculty">Faculty</label><select id="loan-faculty" className="select" name="faculty" required defaultValue={loan.faculty}><option value="" disabled>Choose faculty</option>{FACULTIES.map(f => <option key={f.code} value={f.code}>{f.code} · {f.thai}</option>)}</select></div>
        <div className="field"><label htmlFor="loan-student">Student ID</label><input id="loan-student" className="input" name="studentId" required pattern="[0-9]{10}" maxLength={10} defaultValue={loan.studentId} /></div>
        <div className="field"><label htmlFor="loan-sport">Sport / activity</label><input id="loan-sport" className="input" name="sport" required maxLength={100} defaultValue={loan.sport} /></div>
        <div className="field"><label htmlFor="loan-borrowed">Borrowed at</label><input id="loan-borrowed" className="input" name="borrowedAt" type="datetime-local" required defaultValue={toLocalInput(loan.borrowedAt)} /></div>
        <div className="field"><label htmlFor="loan-returned">Returned at</label><input id="loan-returned" className="input" name="returnedAt" type="datetime-local" required={returned} disabled={!returned} defaultValue={toLocalInput(loan.returnedAt ?? openedAt)} /></div>
        <label className="participant-edit__incomplete field--wide"><input type="checkbox" checked={returned} onChange={e => setReturned(e.target.checked)} /><span>Kit has been returned</span></label>
        <div className="field field--wide"><label htmlFor="loan-note">Note</label><input id="loan-note" className="input" name="note" maxLength={300} defaultValue={loan.note} /></div>
      </div>
      {loan.returnPhotoUrl && <ReturnPhoto url={loan.returnPhotoUrl} kitNumber={loan.kitNumber} large />}
      {loan.returnerName && <p className="kit-log__muted">Returned by {loan.returnerName} ({loan.returnerStudentId}){loan.returnedByName ? ` · logged by ${loan.returnedByName}` : ""}</p>}
      {error && <div role="alert" className="notice notice--error">{error}</div>}
      <div className="participant-edit__actions">
        {isAdmin && <button type="button" className="button button--danger" onClick={() => void destroy()} style={{ marginRight: "auto" }}><Trash2 size={14} /> Delete</button>}
        <button type="button" className="button button--ghost" onClick={onClose}>Cancel</button>
        <button className="button button--primary">{busy ? "Saving…" : "Save correction"}</button>
      </div>
    </fieldset></form>
  </aside></>;
}
