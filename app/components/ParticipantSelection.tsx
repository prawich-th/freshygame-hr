"use client";

import { SPORTS } from "@/shared/sports";
import Link from "next/link";
import { useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "../lib/errors";

type Candidate = {id: Id<"participants">; studentId: string; name: string; thaiName: string; sport: string};

export function ParticipantSelection() {
  const [sport, setSport] = useState("");
  const convex = useConvex();
  const remove = useMutation(api.participants.keepOnlySelected);
  const resume = useMutation(api.participants.resumeRemoval);
  const job = useQuery(api.participants.latestRemoval);
  const [rows, setRows] = useState<Candidate[] | null>(null);
  const [keep, setKeep] = useState<Set<Id<"participants">>>(new Set());
  const [stage, setStage] = useState<"select" | "review">("select");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(100);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviewGroup, setReviewGroup] = useState<"remove" | "keep">("remove");
  const active = job?.status === "running" || job?.status === "paused";
  const matches = (rows ?? []).filter(p => stage === "review" ? keep.has(p.id) === (reviewGroup === "keep") : `${p.name} ${p.thaiName} ${p.studentId} ${p.sport}`.toLowerCase().includes(search.toLowerCase()));
  const shown = matches.slice(0, limit);
  async function open() {
    setBusy(true); setError("");
    try {
      const participants = await convex.query(api.participants.removalCandidates, {sport});
      setRows(participants); setKeep(new Set()); setStage("select"); setSearch(""); setLimit(100); setConfirmation("");
    } catch (e) { setError(errorMessage(e, "Load participants for selection")); }
    finally { setBusy(false); }
  }
  function toggle(id: Id<"participants">) { setKeep(current => {const next = new Set(current); if(next.has(id)) next.delete(id); else next.add(id); return next;}); }
  async function confirm() {
    if (!rows) return;
    setBusy(true); setError("");
    try {
      await remove({sport, keepIds: [...keep], reviewedIds: rows.map(p => p.id), confirmation});
      setRows(null);
    } catch (e) { setError(errorMessage(e, "Remove unselected participants")); }
    finally { setBusy(false); }
  }
  async function resumeJob() {
    if (!job) return;
    setBusy(true); setError("");
    try { await resume({jobId: job.id}); }
    catch (e) { setError(errorMessage(e, "Resume participant removal")); }
    finally { setBusy(false); }
  }
  return <section className="content-card" style={{marginBottom:16}}>
    <Link href="/staff" className="button button--ghost">← Back to participants</Link>
    <div className="field" style={{margin:"16px 0"}}><label htmlFor="selection-sport">Sport / activity</label><select id="selection-sport" className="select" value={sport} disabled={busy || active} onChange={e => {setSport(e.target.value);setRows(null);setKeep(new Set());setError("");}}><option value="">Choose a sport or activity</option>{SPORTS.map(s => <option key={s.code} value={s.name}>{s.thai} / {s.name}</option>)}{["Katakorn", "Cheerleader", "Parade", "Support team"].map(value => <option key={value}>{value}</option>)}</select></div>
    <button className="button button--soft" disabled={!sport || busy || active || job === undefined} onClick={() => void open()}>{busy && !rows ? "Loading…" : `Load ${sport || "sport"} participants`}</button>
    {job && <div className={`notice ${job.status === "complete" ? "notice--success" : "notice--info"}`} role="status" style={{marginTop:12}}>
      {job.status === "complete" ? `${job.sport ?? "Previous removal"}: ${job.removeCount - job.skippedCount} participants removed; ${job.keepCount} selected participants kept.${job.skippedCount ? ` ${job.skippedCount} participants moved to another sport and were left untouched.` : ""}` : `${job.sport ?? "Previous removal"}: ${job.processed} of ${job.removeCount} removals completed. ${job.status === "paused" ? "The last batch could not finish. Resume to retry the remaining records." : "Removal continues if you leave this page."}`}
      {job.status === "paused" && <button className="button button--soft" disabled={busy} onClick={() => void resumeJob()}>Resume removal</button>}
    </div>}
    {error && !rows && <div className="notice notice--error" role="alert">{error}</div>}
    {rows && <section aria-labelledby="selection-title">
      <div className="drawer__head"><h2 id="selection-title">{sport} — {stage === "select" ? "Choose participants to keep" : "Review permanent removal"}</h2><button disabled={busy} onClick={() => setRows(null)} aria-label="Close selection">✕</button></div>
      <div style={{padding:24}}>
        <p><strong>{keep.size} keep · {rows.length - keep.size} remove · {rows.length} total</strong></p>
        <div className="notice notice--info">This selection covers {sport} only. Participants in other sports and activities will stay untouched. Checked participants will stay. Everyone else in this review will be permanently removed with their documents and upload sessions. Audit history is retained.</div>
        {stage === "select" ? <>
          <label htmlFor="keep-search">Find participants to keep</label><input id="keep-search" className="input" placeholder="Name, Student ID, or activity" value={search} onChange={e => {setSearch(e.target.value); setLimit(100);}}/>
          <div style={{display:"flex",gap:8,margin:"12px 0",flexWrap:"wrap"}}><button className="button button--soft" onClick={() => setKeep(current => new Set([...current, ...matches.map(p => p.id)]))}>Keep all {matches.length} matching</button><button className="button button--ghost" onClick={() => setKeep(new Set())}>Clear selection</button></div>
        </> : <>
          <p>Review both lists below. Participants registered after confirmation will not be removed.</p>
          <div style={{display:"flex",gap:8,marginBottom:12}}><button className="button button--soft" aria-pressed={reviewGroup === "keep"} onClick={() => {setReviewGroup("keep");setLimit(100);}}>Keeping ({keep.size})</button><button className="button button--danger" aria-pressed={reviewGroup === "remove"} onClick={() => {setReviewGroup("remove");setLimit(100);}}>Removing ({rows.length - keep.size})</button></div>
        </>}
        <div style={{overflowX:"auto",maxHeight:"45vh",overflowY:"auto"}}><table className="data-table"><thead><tr><th>{stage === "select" ? "Keep" : "Result"}</th><th>Participant</th><th>Student ID</th><th>Activity</th></tr></thead><tbody>{shown.map(p => <tr key={p.id} onClick={stage === "select" ? () => toggle(p.id) : undefined}><td>{stage === "select" ? <input type="checkbox" aria-label={`Keep ${p.name} (${p.studentId})`} checked={keep.has(p.id)} onClick={e => e.stopPropagation()} onChange={() => toggle(p.id)}/> : keep.has(p.id) ? "Keep" : "Remove"}</td><td>{p.thaiName}<br/>{p.name}</td><td>{p.studentId}</td><td>{p.sport}</td></tr>)}</tbody></table>{!matches.length && <p>No participants in this list.</p>}</div>
        {shown.length < matches.length && <button className="button button--ghost" onClick={() => setLimit(value => value + 100)}>Show more ({shown.length} of {matches.length})</button>}
        {error && <div className="notice notice--error" role="alert">{error}</div>}
        {stage === "review" && <div className="field" style={{marginTop:16}}><label htmlFor="remove-confirm">This cannot be undone. Type REMOVE OTHERS to confirm.</label><input id="remove-confirm" className="input" value={confirmation} disabled={busy} onChange={e => setConfirmation(e.target.value)} autoComplete="off"/></div>}
        <div style={{display:"flex",gap:8,marginTop:16,flexWrap:"wrap"}}>
          <button className="button button--ghost" disabled={busy} onClick={() => {if(stage === "review") {setStage("select");setConfirmation("");setError("");} else setRows(null);}}>{stage === "review" ? "Back to selection" : "Cancel"}</button>
          {stage === "select" ? <button className="button button--primary" disabled={!keep.size || keep.size === rows.length} onClick={() => {setStage("review");setReviewGroup("remove");setLimit(100);}}>Review removal of {rows.length - keep.size} participants</button> : <button className="button button--danger" disabled={busy || confirmation !== "REMOVE OTHERS"} onClick={() => void confirm()}>{busy ? "Starting removal…" : `Permanently remove ${rows.length - keep.size} participants`}</button>}
        </div>
      </div>
    </section>}
  </section>;
}
