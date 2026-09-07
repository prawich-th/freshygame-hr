"use client";
/* eslint-disable @next/next/no-img-element */

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex, useConvexAuth, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Activity, BadgeCheck, Bell, Check, ChevronRight, CircleGauge, Download, FileDown, FileSpreadsheet, FolderUp, ListFilter, LogOut, Pencil, Save, ScrollText, Search, Smartphone, UserCog, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { FormEvent, type InputHTMLAttributes, useEffect, useMemo, useState } from "react";
import { participantKind, kindLabel, SUPPORT_TYPES, type ParticipantKind } from "@/shared/participantKinds";
import { SPORTS, findSport, normalizeSport } from "@/shared/sports";
import { Brand } from "./Brand";
import { generateParticipantPdf } from "../lib/participantPdf";
import { compressImage, type UploadImageKind } from "../lib/compressImage";

type Tab = "participants" | "import" | "staff" | "audit";
const statusLabel = { incomplete: "Incomplete", pending: "Pending review", verified: "Verified", rejected: "Needs correction" };
const statusClass = { incomplete: "pill--gray", pending: "pill--amber", verified: "pill--green", rejected: "pill--red" };

export function StaffPortal() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  if (isLoading) return <div className="auth-page"><span className="spinner" style={{color:"#4b2f25"}} /></div>;
  return isAuthenticated ? <StaffWorkspace /> : <StaffAuth />;
}

function StaffAuth() {
  const { signIn } = useAuthActions();
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    data.set("flow", register ? "signUp" : "signIn");
    try { await signIn("password", data); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to sign in"); setBusy(false); }
  }

  return <main className="auth-page"><div className="auth-box"><Brand /><section className="auth-card">
    <h1>{register ? "Create staff account" : "Welcome back"}</h1>
    <p>{register ? "Use the invitation code provided by your Freshy Game administrator." : "Sign in to manage participant records and accreditation."}</p>
    <form onSubmit={submit}>
      {register && <div className="field"><label>Full name</label><input className="input" name="name" required placeholder="Your name" /></div>}
      <div className="field"><label>Email address</label><input className="input" type="email" name="email" required placeholder="staff@tu.ac.th" /></div>
      <div className="field"><label>Password</label><input className="input" type="password" name="password" required minLength={register ? 10 : 1} placeholder="••••••••••" /></div>
      {register && <div className="field"><label>Staff invitation code</label><input className="input" type="password" name="inviteCode" required placeholder="Provided by administrator" /></div>}
      {error && <div className="notice notice--error">{error}</div>}
      <button className="button button--primary button--large" disabled={busy}>{busy ? <span className="spinner"/> : register ? "Create account" : "Sign in"}</button>
    </form>
    <div className="auth-toggle">{register ? "Already have an account?" : "Joining the operations team?"} <button onClick={() => { setRegister(!register); setError(""); }}>{register ? "Sign in" : "Register with a code"}</button></div>
  </section></div></main>;
}

function StaffWorkspace() {
  const { signOut } = useAuthActions();
  const current = useQuery(api.participants.currentStaff);
  const stats = useQuery(api.participants.stats);
  const bootstrap = useMutation(api.participants.bootstrapAdmin);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<Tab>("participants");
  const [selectedId, setSelectedId] = useState<Id<"participants"> | null>(null);

  if (current === undefined) return <div className="auth-page"><span className="spinner" style={{color:"#4b2f25"}} /></div>;
  if (current === null) return <div className="auth-page"><section className="auth-card"><h1>Access unavailable</h1><p>Your staff account is not active. Contact an administrator.</p><button className="button button--primary" onClick={() => void signOut()}>Sign out</button></section></div>;

  const nav = [
    { id: "participants" as const, label: "Participants", icon: UsersRound },
    { id: "import" as const, label: "Import data", icon: FolderUp },
    ...(current.role === "admin" ? [
      { id: "staff" as const, label: "Staff & access", icon: UserCog },
      { id: "audit" as const, label: "Audit log", icon: ScrollText },
    ] : []),
  ];
  const title = tab === "participants" ? "Participant overview" : tab === "import" ? "Import participant data" : tab === "staff" ? "Staff access control" : "Security audit log";

  return <main className="staff-shell">
    <aside className="sidebar"><Brand compact/><nav className="sidebar__nav">{nav.map(({id,label,icon:Icon}) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon size={17}/><span>{label}</span></button>)}</nav>
      <div className="sidebar__bottom"><div className="sidebar__user"><span className="sidebar__avatar">{initials(current.name)}</span><div><strong>{current.name}</strong><span>{current.role}</span></div><button title="Sign out" onClick={() => void signOut()}><LogOut size={15}/></button></div></div>
    </aside>
    <section className="staff-main">
      <header className="staff-topbar"><div><h1>{title}</h1><p>Freshy Game 2026 · Brown Team Human Resource</p></div><div className="staff-topbar__actions"><Link className="button button--soft" href="/staff/upload"><Smartphone size={15}/><span>Booth mode</span></Link><button className="icon-button" title="Notifications"><Bell size={17}/></button>{tab === "participants" && current.role !== "viewer" && <button className="button button--soft" onClick={() => setCreating(true)}>Create participant</button>}{tab === "participants" && <button className="button button--primary" onClick={() => setTab("import")}><FolderUp size={15}/><span>Import CSV</span></button>}</div></header>
      {current.canBootstrap && <div className="notice notice--info" style={{marginBottom:16}}>No administrator exists yet. <button className="button button--soft" style={{marginLeft:8,minHeight:30}} onClick={() => void bootstrap()}>Make me the first admin</button></div>}
      {tab === "participants" && <ParticipantDashboard stats={stats} selectedId={selectedId} setSelectedId={setSelectedId} canEdit={current.role !== "viewer"}/>} 
      {creating && current.role !== "viewer" && <CreateParticipantDrawer onClose={() => setCreating(false)} onCreated={id => { setCreating(false); setSelectedId(id); }} />}
      {tab === "import" && <ImportPanel />}
      {tab === "staff" && current.role === "admin" && <StaffPanel />}
      {tab === "audit" && current.role === "admin" && <AuditPanel />}
    </section>
  </main>;
}

function ParticipantDashboard({ stats, selectedId, setSelectedId, canEdit }: { stats: { total:number;complete:number;pending:number;sports:number } | undefined; selectedId: Id<"participants"> | null; setSelectedId:(id:Id<"participants">|null)=>void; canEdit:boolean }) {
  const { results, status, loadMore } = usePaginatedQuery(api.participants.list, {}, { initialNumItems: 50 });
  const convex = useConvex();
  const [search, setSearch] = useState(""); const [filter, setFilter] = useState("all"); const [faculty, setFaculty] = useState(""); const [sport, setSport] = useState(""); const [filterOpen,setFilterOpen]=useState(false); const [autoLoadingFilters,setAutoLoadingFilters]=useState(false); const [draftFilter,setDraftFilter]=useState("all"); const [draftFaculty,setDraftFaculty]=useState(""); const [draftSport,setDraftSport]=useState(""); const [exporting,setExporting]=useState(false); const [selectedIds,setSelectedIds]=useState<Set<Id<"participants">>>(new Set()); const [exportError,setExportError]=useState("");
  const faculties = useMemo(() => [...new Set(results.map(p=>p.faculty).filter(Boolean))].sort(), [results]);
  const sports = useMemo(() => [...new Set(results.map(p=>p.sport).filter(Boolean))].sort(), [results]);
  const visible = useMemo(() => results.filter((p) => {
    const haystack = `${p.fullNameThai} ${p.fullNameEnglish} ${p.studentId} ${p.sport} ${p.faculty} ${p.participantKind}`.toLowerCase();
    return haystack.includes(search.toLowerCase()) && (filter === "all" || p.status === filter) && (!faculty || p.faculty === faculty) && (!sport || p.sport === sport);
  }), [results, search, filter, faculty, sport]);
  const selectableVisible=visible.slice(0,50);
  async function exportSelectedSport(){if(!sport)return;setExporting(true);try{const entries=await convex.query(api.participants.exportSport,{sport});await generateParticipantPdf(entries,`Freshy-Game-${sport}`);}finally{setExporting(false);}}
  function toggleParticipant(id:Id<"participants">){if(!selectedIds.has(id)&&selectedIds.size>=50){setExportError("A bulk PDF can contain at most 50 participants.");return;}setExportError("");setSelectedIds(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;});}
  function toggleVisible(){const visibleIds=selectableVisible.map(person=>person._id);const allSelected=visibleIds.length>0&&visibleIds.every(id=>selectedIds.has(id));setExportError(!allSelected&&visible.length>50?"Selected the first 50 matching participants. Export them before continuing.":"");setSelectedIds(current=>{const next=new Set(current);if(allSelected)visibleIds.forEach(id=>next.delete(id));else visibleIds.forEach(id=>{if(next.size<50)next.add(id);});return next;});}
  async function exportBulk(){if(!selectedIds.size)return;setExporting(true);setExportError("");try{const participantIds=[...selectedIds];const entries=await convex.query(api.participants.exportSelected,{participantIds});await generateParticipantPdf(entries,`Freshy-Game-Bulk-${participantIds.length}`);}catch(error){setExportError(error instanceof Error?error.message:"Bulk export failed");}finally{setExporting(false);}}
  function openFilters(){setDraftFilter(filter);setDraftFaculty(faculty);setDraftSport(sport);setFilterOpen(true);}
  function applyFilters(){setFilter(draftFilter);setFaculty(draftFaculty);setSport(draftSport);setAutoLoadingFilters(true);setFilterOpen(false);}
  function clearFilters(){setDraftFilter("all");setDraftFaculty("");setDraftSport("");setFilter("all");setFaculty("");setSport("");setAutoLoadingFilters(false);setFilterOpen(false);}
  useEffect(()=>{if(autoLoadingFilters&&status==="CanLoadMore")loadMore(100);},[autoLoadingFilters,status,loadMore]);
  const allVisibleSelected=selectableVisible.length>0&&selectableVisible.every(person=>selectedIds.has(person._id));
  const activeFilterCount=(filter!=="all"?1:0)+(faculty?1:0)+(sport?1:0);
  return <>
    <div className="stats-grid">
      <Stat label="All participants" value={stats?.total} icon={UsersRound}/><Stat label="Verified" value={stats?.complete} icon={BadgeCheck}/><Stat label="Awaiting review" value={stats?.pending} icon={Activity}/><Stat label="Activities" value={stats?.sports} icon={CircleGauge}/>
    </div>
    <section className="panel"><div className="panel__head"><h2>Participant records</h2><div className="filters"><div className="search-wrap"><Search size={14}/><input className="input input--search" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search name or student ID"/></div><button className="button button--soft filter-trigger" aria-haspopup="dialog" aria-expanded={filterOpen} onClick={openFilters}><ListFilter size={15}/> Filters{activeFilterCount>0&&<span className="filter-count">{activeFilterCount}</span>}</button>{sport&&<button className="button button--soft" disabled={exporting} onClick={()=>void exportSelectedSport()}>{exporting?<span className="spinner" style={{color:"#4b2f25"}}/>:<Download size={14}/>} Sport PDF</button>}{selectedIds.size>0&&<button className="button button--primary" disabled={exporting} onClick={()=>void exportBulk()}>{exporting?<span className="spinner"/>:<Download size={14}/>} Bulk PDF ({selectedIds.size})</button>}{selectedIds.size>0&&<button className="icon-button" title="Clear selection" onClick={()=>setSelectedIds(new Set())}><X size={14}/></button>}</div></div>
      {exportError&&<div className="notice notice--error bulk-export-notice">{exportError}</div>}
      <div style={{overflowX:"auto"}}><table className="data-table"><thead><tr><th className="selection-cell"><input type="checkbox" aria-label="Select all filtered participants" checked={allVisibleSelected} onChange={toggleVisible}/></th><th>Participant</th><th>Student ID</th><th>Role</th><th>Faculty</th><th>Sport / Performance</th><th>Category</th><th>Status</th><th></th></tr></thead><tbody>{visible.map((p) => <tr key={p._id} onClick={() => setSelectedId(p._id)}><td className="selection-cell" onClick={event=>event.stopPropagation()}><input type="checkbox" aria-label={`Select ${p.fullNameEnglish}`} checked={selectedIds.has(p._id)} onChange={()=>toggleParticipant(p._id)}/></td><td><div className="person-cell">{p.photoUrl ? <img className="person-cell__avatar" src={p.photoUrl} alt=""/> : <span className="person-cell__avatar">{initials(p.fullNameEnglish)}</span>}<div><strong>{p.fullNameThai}</strong><span>{p.fullNameEnglish}</span></div></div></td><td>{p.studentId}</td><td><span className={`pill ${p.participantKind === "performer" ? "pill--cream" : "pill--gray"}`}>{kindLabel[participantKind(p)]}</span></td><td>{p.faculty}</td><td>{p.sport}</td><td>{p.category || "—"}</td><td><span className={`pill ${statusClass[p.status]}`}>{statusLabel[p.status]}</span></td><td><ChevronRight size={14}/></td></tr>)}{!visible.length && <tr><td colSpan={9} className="empty-state">No matching participants</td></tr>}</tbody></table></div>
      {autoLoadingFilters&&status!=="Exhausted"?<div className="filter-loading"><span className="spinner"/> Loading all participants for this filter…</div>:status === "CanLoadMore"&&<div style={{padding:15,textAlign:"center"}}><button className="button button--ghost" onClick={() => loadMore(50)}>Load more</button></div>}
    </section>
    {filterOpen&&<><div className="filter-modal-backdrop" onClick={()=>setFilterOpen(false)}/><form className="filter-modal" role="dialog" aria-modal="true" aria-labelledby="participant-filter-title" onSubmit={event=>{event.preventDefault();applyFilters();}}><div className="filter-modal__head"><div><h2 id="participant-filter-title">Filter participants</h2><p>Narrow records by status, faculty, and activity.</p></div><button type="button" className="icon-button" aria-label="Close filters" onClick={()=>setFilterOpen(false)}><X size={17}/></button></div><div className="filter-modal__body"><div className="field"><label htmlFor="participant-status-filter">Status</label><select id="participant-status-filter" className="select" value={draftFilter} onChange={e=>setDraftFilter(e.target.value)}><option value="all">All statuses</option><option value="incomplete">Incomplete</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Correction needed</option></select></div><div className="field"><label htmlFor="participant-faculty-filter">Faculty</label><select id="participant-faculty-filter" className="select" value={draftFaculty} onChange={e=>setDraftFaculty(e.target.value)}><option value="">All faculties</option>{faculties.map(value=><option key={value} value={value}>{value}</option>)}</select></div><div className="field"><label htmlFor="participant-sport-filter">Sport / performance</label><select id="participant-sport-filter" className="select" value={draftSport} onChange={e=>setDraftSport(e.target.value)}><option value="">All activities</option>{sports.map(value=><option key={value} value={value}>{value}</option>)}</select></div></div><div className="filter-modal__actions"><button type="button" className="button button--ghost" onClick={clearFilters}>Clear all</button><div><button type="button" className="button button--soft" onClick={()=>setFilterOpen(false)}>Cancel</button><button className="button button--primary">Apply filters</button></div></div></form></>}
    {selectedId && <ParticipantDrawer key={selectedId} id={selectedId} onClose={() => setSelectedId(null)} canEdit={canEdit}/>}
  </>;
}

function Stat({label,value,icon:Icon}:{label:string;value?:number;icon:typeof UsersRound}) { return <article className="stat-card"><div><span>{label}</span><strong>{value ?? "—"}</strong></div><span className="stat-card__icon"><Icon size={17}/></span></article>; }

function ParticipantDrawer({ id, onClose, canEdit }: { id:Id<"participants">; onClose:()=>void; canEdit:boolean }) {
  const detail = useQuery(api.participants.get, { participantId:id });
  const [pdfState, setPdfState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [pdfError, setPdfError] = useState("");
  const updateStatus = useMutation(api.participants.updateStatus);
  const updateParticipant = useMutation(api.participants.updateParticipant);
  const generateUploadUrl = useMutation(api.participants.generateStaffUploadUrl);
  const completeUpload = useMutation(api.participants.completeStaffUpload);
  const [files,setFiles] = useState<{profile?:File;nationalId?:File;studentId?:File}>({}); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const [editing,setEditing]=useState(false); const [editKind,setEditKind]=useState<ParticipantKind>("athlete");
  if (!detail) return <><div className="drawer-backdrop" onClick={onClose}/><aside className="drawer"><span className="spinner" style={{color:"#4b2f25"}}/></aside></>;
  const p = detail.participant;
  async function downloadPdf() {
    if (!detail || pdfState === "loading") return;
    setPdfState("loading");
    setPdfError("");
    try {
      await generateParticipantPdf([detail], `${p.studentId}-${p.fullNameEnglish}`);
      setPdfState("success");
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : "Unable to generate PDF");
      setPdfState("error");
    }
  }
  async function saveStatus(nextStatus: "incomplete"|"pending"|"verified"|"rejected") { setBusy(true); try { await updateStatus({participantId:id,status:nextStatus}); setMessage("Record updated"); } catch(e){setMessage(e instanceof Error?e.message:"Update failed");} finally {setBusy(false);} }
  function startEditing(){setEditKind(participantKind(p));setMessage("");setEditing(true);}
  async function saveParticipant(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setMessage("");const data=new FormData(event.currentTarget);try{const performerType=editKind==="performer"?String(data.get("performerType")) as "Katakorn"|"Cheerleader"|"Parade":undefined;const faculty=String(data.get("faculty")) as "คณะแพทยศาสตร์"|"คณะศิลปศาสตร์"|"คณะแพทยศาสตร์นานาชาติจุฬาภรณ์";await updateParticipant({participantId:id,participantKind:editKind,performerType,studentId:String(data.get("studentId")),fullNameThai:String(data.get("fullNameThai")),fullNameEnglish:String(data.get("fullNameEnglish")),nicknameThai:optional(String(data.get("nicknameThai"))),nicknameEnglish:optional(String(data.get("nicknameEnglish"))),sex:optional(String(data.get("sex"))),faculty,sport:editKind==="support"?"Support team":editKind==="performer"?(performerType??""):String(data.get("sport")),category:optional(String(data.get("category"))),email:optional(String(data.get("email"))),phone:optional(String(data.get("phone"))),lineId:optional(String(data.get("lineId"))),instagram:optional(String(data.get("instagram"))),preferredContact:optional(String(data.get("preferredContact")))});setMessage("Participant information saved");setEditing(false);}catch(e){setMessage(e instanceof Error?e.message:"Update failed");}finally{setBusy(false);}}
  async function staffUpload(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setMessage("");try{const upload=async(file:File|undefined,kind:UploadImageKind)=>{if(!file)return undefined;const compressed=await compressImage(file,kind);const url=await generateUploadUrl();const response=await fetch(url,{method:"POST",headers:{"Content-Type":compressed.type},body:compressed});if(!response.ok)throw new Error("Image upload failed");return (await response.json()).storageId as Id<"_storage">;};const profilePhotoId=await upload(files.profile,"profile");const nationalIdImageId=await upload(files.nationalId,"nationalId");const studentIdImageId=await upload(files.studentId,"studentId");await completeUpload({participantId:id,profilePhotoId,nationalIdImageId,studentIdImageId});setMessage("Identity documents saved");setFiles({});}catch(e){setMessage(e instanceof Error?e.message:"Upload failed");}finally{setBusy(false);}}
  return <><div className="drawer-backdrop" onClick={onClose}/><aside className="drawer"><div className="drawer__head"><h2>Participant record</h2><button onClick={onClose}><X size={17}/></button></div>
    <div className="drawer__profile">{detail.photoUrl?<img className="drawer__photo" src={detail.photoUrl} alt={p.fullNameThai}/>:<div className="drawer__photo">{initials(p.fullNameEnglish)}</div>}<div><h3>{p.fullNameThai}</h3><p>{p.fullNameEnglish}</p><span className={`pill ${statusClass[p.status]}`}>{statusLabel[p.status]}</span></div></div>
    {editing?<form className="participant-edit" onSubmit={saveParticipant}><ParticipantFields p={p} editKind={editKind} setEditKind={setEditKind}/>{message&&<div className={`notice ${message.includes("saved")?"notice--success":"notice--error"}`}>{message}</div>}<div className="participant-edit__actions"><button type="button" className="button button--ghost" disabled={busy} onClick={()=>{setEditing(false);setMessage("");}}>Cancel</button><button className="button button--primary" disabled={busy}>{busy?<span className="spinner"/>:<><Save size={14}/> Save information</>}</button></div></form>:<><div className="detail-grid"><Detail label="Student ID" value={p.studentId}/><Detail label="Role" value={kindLabel[participantKind(p)]}/><Detail label="Category / Type" value={p.category ?? "—"}/><Detail label={participantKind(p) === "support" ? "Team" : p.participantKind === "performer" ? "Performance" : "Sport"} value={p.sport}/><Detail label="Email" value={p.email ?? "—"}/><Detail label="Phone" value={p.phone ?? "—"}/><Detail label="Faculty" value={p.faculty}/><Detail label="Preferred contact" value={p.preferredContact ?? "—"}/><Detail label="LINE ID" value={p.lineId ?? "—"}/><Detail label="Instagram" value={p.instagram ? `@${p.instagram}` : "—"}/><Detail label="Nickname" value={`${p.nicknameThai ?? "—"} / ${p.nicknameEnglish ?? "—"}`}/><Detail label="Sex" value={p.sex ?? "—"}/></div>{message&&<div className={`notice ${message.includes("saved")||message.includes("updated")?"notice--success":"notice--error"}`}>{message}</div>}</>}
    <div className="document-previews"><DocumentPreview label="National ID card" url={detail.nationalIdImageUrl}/><DocumentPreview label="Student ID card" url={detail.studentIdImageUrl}/></div>
    <div className="drawer__actions"><button className="button button--soft" disabled={pdfState === "loading"} aria-busy={pdfState === "loading"} onClick={()=>void downloadPdf()}>{pdfState === "loading" ? <><span className="spinner" style={{color:"#4b2f25"}}/> Preparing PDF…</> : <><FileDown size={14}/> Export PDF</>}</button>{canEdit && <><button className="button button--soft" disabled={busy||editing} onClick={startEditing}><Pencil size={14}/> Edit information</button><button className="button button--soft" disabled={busy||editing} onClick={()=>void saveStatus("verified")}><Check size={14}/> Verify</button><button className="button button--danger" disabled={busy||editing} onClick={()=>void saveStatus("rejected")}>Request correction</button></>}</div>
    <div aria-live="polite" aria-atomic="true">{pdfState !== "idle" && <div className={`notice ${pdfState === "error" ? "notice--error" : pdfState === "success" ? "notice--success" : "notice--info"}`} style={{margin:"0 24px 16px"}}>{pdfState === "loading" ? "Preparing your PDF. Please wait…" : pdfState === "success" ? "PDF download started. Check your browser’s downloads." : `PDF download failed: ${pdfError}. Please try again.`}</div>}</div>
    {canEdit && <form className="staff-upload" onSubmit={staffUpload}><h3>Update document images</h3><p>Images are compressed automatically. ID card images receive the Freshy Game official-use watermark.</p><div className="form-grid"><FileField label="Profile photo" onFile={file=>setFiles(current=>({...current,profile:file}))}/><FileField label="National ID card" onFile={file=>setFiles(current=>({...current,nationalId:file}))}/><div className="field field--wide"><FileField label="Student ID card" onFile={file=>setFiles(current=>({...current,studentId:file}))}/></div></div><button className="button button--primary" disabled={busy}>{busy?<span className="spinner"/>:"Save document images"}</button></form>}
  </aside></>;
}

function ParticipantFields({p, editKind, setEditKind}: {p: Partial<Doc<"participants">>; editKind: ParticipantKind; setEditKind: (kind: ParticipantKind) => void}) {
  const [performerTeam, setPerformerTeam] = useState(p.performerType ?? "");
  return <div className="form-grid"><EditField name="studentId" label="Student ID" defaultValue={p.studentId} required inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} placeholder="6909680123"/><div className="field"><label>Role <span>*</span></label><select className="select" value={editKind} onChange={e=>setEditKind(e.target.value as ParticipantKind)}><option value="athlete">Athlete / participant</option><option value="performer">Performer</option><option value="support">Support team</option></select></div>{editKind==="performer"?<div className="field field--wide"><label>Performer team <span>*</span></label><select className="select" name="performerType" required value={performerTeam} onChange={e => setPerformerTeam(e.target.value as typeof performerTeam)}><option value="" disabled>Select team</option><option value="Katakorn">Katakorn</option><option value="Cheerleader">Cheerleader</option><option value="Parade">Parade</option></select></div>:editKind === "athlete" ? <SportFields sport={p.sport} category={p.category}/> : null}<EditField name="fullNameThai" label="Thai full name" defaultValue={p.fullNameThai} required/><EditField name="nicknameThai" label="Thai nickname" defaultValue={p.nicknameThai}/><EditField name="fullNameEnglish" label="English full name" defaultValue={p.fullNameEnglish} required/><EditField name="nicknameEnglish" label="English nickname" defaultValue={p.nicknameEnglish}/><div className="field"><label>Faculty <span>*</span></label><select className="select" name="faculty" required defaultValue={p.faculty}><option value="" disabled>Select faculty</option><option value="คณะแพทยศาสตร์">คณะแพทยศาสตร์</option><option value="คณะศิลปศาสตร์">คณะศิลปศาสตร์</option><option value="คณะแพทยศาสตร์นานาชาติจุฬาภรณ์">คณะแพทยศาสตร์นานาชาติจุฬาภรณ์</option></select></div><EditField name="sex" label="Sex" defaultValue={p.sex}/>{editKind === "support" && <div className="field"><label htmlFor="support-subtype">Support subtype <span>*</span></label><select id="support-subtype" className="select" name="category" required defaultValue={participantKind(p) === "support" ? p.category ?? "" : ""}><option value="" disabled>Select subtype</option>{SUPPORT_TYPES.map(type => <option key={type}>{type}</option>)}</select></div>}{editKind === "performer" && <EditField name="category" label="Category / type" defaultValue={participantKind(p) === "performer" ? p.category : ""}/>}<EditField name="phone" label="Phone" defaultValue={p.phone} type="tel"/><EditField name="email" label="Email" defaultValue={p.email} type="email"/><EditField name="preferredContact" label="Preferred contact" defaultValue={p.preferredContact}/><EditField name="lineId" label="LINE ID" defaultValue={p.lineId}/><EditField name="instagram" label="Instagram" defaultValue={p.instagram}/></div>;
}

function SportFields({sport = "", category = ""}: {sport?: string; category?: string}) {
  const [selected, setSelected] = useState(normalizeSport(sport));
  const [type, setType] = useState(category);
  const definition = findSport(selected);
  return <><div className="field"><label htmlFor="participant-sport">Sport <span>*</span></label><select id="participant-sport" className="select" name="sport" required value={selected} onChange={e => { const next = findSport(e.target.value); setSelected(e.target.value); setType(next?.types.length === 1 ? next.types[0] : ""); }}><option value="" disabled>Select sport</option>{selected && !definition && <option value={selected}>{selected} (existing)</option>}{SPORTS.map(s => <option key={s.code} value={s.name}>{s.thai} / {s.name}</option>)}</select></div><div className="field"><label htmlFor="participant-type">Category / type <span>*</span></label><select id="participant-type" className="select" name="category" required value={type} onChange={e => setType(e.target.value)}><option value="" disabled>Select type</option>{type && !definition?.types.includes(type) && <option value={type}>{type} (existing)</option>}{definition?.types.map(value => <option key={value}>{value}</option>)}</select>{(selected === "Taekwondo" || selected === "Amateur Boxing") && <small>Weight classes are assigned separately; CSV Type may include the weight class.</small>}</div></>;
}

function CreateParticipantDrawer({onClose, onCreated}: {onClose: () => void; onCreated: (id: Id<"participants">) => void}) {
  const create = useMutation(api.participants.createParticipant);
  const [editKind, setEditKind] = useState<ParticipantKind>("athlete");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "");
    const performerType = editKind === "performer" ? value("performerType") as "Katakorn" | "Cheerleader" | "Parade" : undefined;
    try {
      const id = await create({participant: {
        participantKind: editKind, performerType,
        studentId: value("studentId"), fullNameThai: value("fullNameThai"), fullNameEnglish: value("fullNameEnglish"), faculty: value("faculty"),
        sport: editKind === "support" ? "Support team" : performerType ?? value("sport"), category: optional(value("category")),
        nicknameThai: optional(value("nicknameThai")), nicknameEnglish: optional(value("nicknameEnglish")), sex: optional(value("sex")),
        email: optional(value("email")), phone: optional(value("phone")), lineId: optional(value("lineId")), instagram: optional(value("instagram")), preferredContact: optional(value("preferredContact")),
      }});
      onCreated(id);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create participant"); }
    finally { setBusy(false); }
  }
  return <><div className="drawer-backdrop" onClick={busy ? undefined : onClose}/><aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="create-participant-title"><div className="drawer__head"><h2 id="create-participant-title">Create participant</h2><button disabled={busy} onClick={onClose} aria-label="Close"><X size={17}/></button></div><form className="participant-edit" onSubmit={submit}><p>Create the record now and add document images later.</p><ParticipantFields p={{}} editKind={editKind} setEditKind={setEditKind}/>{error && <div className="notice notice--error">{error}</div>}<div className="participant-edit__actions"><button type="button" className="button button--ghost" disabled={busy} onClick={onClose}>Cancel</button><button className="button button--primary" disabled={busy}>{busy ? "Creating…" : "Create participant"}</button></div></form></aside></>;
}

function Detail({label,value}:{label:string;value:string}) { return <div className="detail-item"><small>{label}</small><span>{value}</span></div>; }
function EditField({label,...props}:{label:string}&InputHTMLAttributes<HTMLInputElement>){return <div className="field"><label>{label}{props.required&&<> <span>*</span></>}</label><input className="input" {...props}/></div>;}
function DocumentPreview({label,url}:{label:string;url:string|null}) { return <div className="document-preview"><small>{label}</small>{url?<a href={url} target="_blank" rel="noreferrer"><img src={url} alt={label}/></a>:<div><FileSpreadsheet size={22}/><span>Not submitted</span></div>}</div>; }
function FileField({label,onFile}:{label:string;onFile:(file:File|undefined)=>void}) { return <div className="field"><label>{label}</label><input className="input" style={{paddingTop:10}} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>onFile(e.target.files?.[0])}/></div>; }

function ImportPanel() {
  const importBatch = useMutation(api.participants.importBatch); const [busy,setBusy]=useState(false); const [result,setResult]=useState("");
  async function handleFile(file?:File){if(!file)return;setBusy(true);setResult("");try{const text=await file.text();const rows=parseCsv(text);const mapped=rows.map((row,index)=>mapParticipantRow(row,index+2)).filter((p)=>p.studentId&&p.fullNameEnglish);let created=0,updated=0;for(let i=0;i<mapped.length;i+=100){const batch=await importBatch({participants:mapped.slice(i,i+100)});created+=batch.created;updated+=batch.updated;}setResult(`Imported ${mapped.length} rows — ${created} created, ${updated} updated.`);}catch(e){setResult(e instanceof Error?e.message:"Import failed");}finally{setBusy(false);}}
  return <section className="content-card"><h2>Bring in your participant list</h2><p>Upload the CSV file. Existing participants are matched and updated by Student ID.</p><a className="button button--soft" href="/templates/participants.csv" download="Freshy-Game-Participant-Template.csv"><Download size={15}/> Download CSV template</a><p>Replace the example rows with your participants and keep the column headers. Use the sport codes and types listed below, then save as UTF-8 CSV.</p><div className="drop-csv"><input id="csv" type="file" accept=".csv,text/csv" disabled={busy} onChange={e=>void handleFile(e.target.files?.[0])}/><label htmlFor="csv">{busy?<span className="spinner" style={{color:"#4b2f25"}}/>:<FileSpreadsheet size={33}/>}<strong>{busy?"Importing participants…":"Choose a CSV file"}</strong><span>UTF-8 CSV · Up to 100 rows processed per secure batch</span></label></div>{result&&<div className={`notice import-result ${result.startsWith("Imported")?"notice--success":"notice--error"}`}>{result}</div>}<div className="notice notice--info" style={{marginTop:16}}>Columns: <strong>Student ID, Name, Nickname, ชื่อ-สกุล, ชื่อเล่น, Sex, Faculty, Sport Code (or Sport), Type, Phone number, Email</strong>. Use <strong>Parade</strong> (or <strong>ขบวนพาเหรด</strong>) in Sport or Type for normal parade members; they are classified as performers automatically. For support members, use <strong>Support team</strong> in Sport Code (or Sport) and <strong>Camera</strong> or <strong>Support team</strong> in Type. Phone numbers are cleaned to 10 digits beginning with 0; email whitespace is trimmed.</div><h3 style={{marginTop:24}}>Sport codes for CSV imports</h3><p>Use a code or sport name. Type accepts the event name or a specific weight class.</p><table className="staff-list"><thead><tr><th>Code</th><th>Sport</th><th>Types</th></tr></thead><tbody>{SPORTS.map(s => <tr key={s.code}><td><strong>{s.code}</strong></td><td>{s.thai} / {s.name}</td><td>{s.types.join(" / ")}</td></tr>)}</tbody></table></section>;
}

function StaffPanel() {
  const staff = useQuery(api.participants.listStaff); const update = useMutation(api.participants.updateStaffRole);
  return <section className="content-card"><h2>Staff accounts</h2><p>Only administrators can change access. Registrars can edit sensitive records; viewers cannot retrieve National ID or Student ID card images.</p><table className="staff-list"><thead><tr><th>Staff member</th><th>Role</th><th>Account</th></tr></thead><tbody>{staff?.map(s=><tr key={s.id}><td><strong>{s.name}</strong><br/><span style={{color:"#8d837e"}}>{s.email}</span></td><td><select className="select" value={s.role} onChange={e=>void update({userId:s.id,role:e.target.value as typeof s.role,active:s.active})}><option value="admin">Admin</option><option value="registrar">Registrar</option><option value="viewer">Viewer</option></select></td><td><button className={`button ${s.active?"button--soft":"button--danger"}`} onClick={()=>void update({userId:s.id,role:s.role,active:!s.active})}>{s.active?"Active":"Inactive"}</button></td></tr>)}</tbody></table></section>;
}

function AuditPanel() {
  const { results, status, loadMore } = usePaginatedQuery(api.participants.listAuditEvents, {}, { initialNumItems: 50 });
  const label = (action:string) => action.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
  return <section className="content-card"><h2>Personal-data activity</h2><p>Verification attempts, self-service submissions, document edits, and staff access changes are recorded here for accountability.</p><div style={{overflowX:"auto"}}><table className="staff-list"><thead><tr><th>Time</th><th>Activity</th><th>Participant</th><th>Actor / IP</th><th>Result</th></tr></thead><tbody>{results.map(event=><tr key={event.id}><td>{new Date(event.createdAt).toLocaleString("th-TH")}</td><td><strong>{label(event.action)}</strong></td><td>{event.participantName ?? "—"}</td><td>{event.staffName ?? event.ipAddress}</td><td><span className={`pill ${event.successful === false ? "pill--red" : event.successful === true ? "pill--green" : "pill--gray"}`}>{event.successful === false ? "Failed" : event.successful === true ? "Success" : "Started"}</span></td></tr>)}</tbody></table></div>{status === "CanLoadMore"&&<div style={{textAlign:"center",paddingTop:16}}><button className="button button--ghost" onClick={()=>loadMore(50)}>Load more</button></div>}</section>;
}

function initials(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(n=>n[0]?.toUpperCase()).join("")||"FG";}

function parseCsv(text:string){const rows:string[][]=[];let row:string[]=[];let cell="";let quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===","&&!quoted){row.push(cell.trim());cell="";}else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&text[i+1]==="\n")i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell="";}else cell+=c;}if(cell||row.length){row.push(cell.trim());rows.push(row);}const headers=rows.shift()?.map(h=>h.replace(/^\uFEFF/,""))??[];return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]??""])));}
const get=(r:Record<string,string>,...keys:string[])=>{for(const key of keys){if(r[key]!==undefined)return r[key];const match=Object.keys(r).find(h=>h.toLowerCase().includes(key.toLowerCase()));if(match)return r[match];}return "";};
function optional(value:string){const trimmed=value.trim();return trimmed||undefined;}
function cleanPhone(value:string,rowNumber:number){if(!value.trim())return undefined;let phone=value.replace(/\D/g,"");if(phone.startsWith("66")){const localNumber=phone.slice(2);phone=localNumber.startsWith("0")?localNumber:`0${localNumber}`;}else if(phone.length===9&&!phone.startsWith("0")){phone=`0${phone}`;}if(!/^0\d{9}$/.test(phone))throw new Error(`Row ${rowNumber}: Phone number could not be cleaned to a valid 10-digit Thai number`);return phone;}
function mapParticipantRow(r:Record<string,string>,rowNumber:number){const fullNameEnglish=get(r,"Name").trim();const fullNameThai=get(r,"ชื่อ-สกุล").trim()||fullNameEnglish;const rawSport=(r["Sport Code"] ?? r["sportCode"] ?? r["sport_code"] ?? get(r,"Sport")).trim();const rawType=get(r,"Type").trim();const isSupport=participantKind({sport:rawSport,category:rawType}) === "support";const performerType=isSupport?undefined:detectImportedPerformer(rawSport,rawType);return {studentId:get(r,"Student ID").trim(),fullNameEnglish,fullNameThai,nicknameEnglish:optional(get(r,"Nickname")),nicknameThai:optional(get(r,"ชื่อเล่น")),sex:optional(get(r,"Sex")),faculty:get(r,"Faculty").trim(),sport:isSupport?"Support team":performerType??normalizeSport(rawSport),category:optional(rawType)||(performerType?"Performer":undefined),participantKind:isSupport?"support" as const:performerType?"performer" as const:"athlete" as const,performerType,phone:cleanPhone(get(r,"Phone number","Phone Number"),rowNumber),email:optional(get(r,"Email").trim().toLowerCase())};}
function detectImportedPerformer(sport:string,category:string):"Katakorn"|"Cheerleader"|"Parade"|undefined{const value=`${sport} ${category}`.toLowerCase();if(/\bkatakorn\b|คทากร/.test(value))return "Katakorn";if(/\bcheerleader\b|เชียร์ลีดเดอร์/.test(value))return "Cheerleader";if(/\bparade(?: member)?\b|ขบวนพาเหรด/.test(value))return "Parade";return undefined;}
