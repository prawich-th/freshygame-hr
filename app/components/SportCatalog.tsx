"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@/convex/_generated/api";
import { useState, type FormEvent } from "react";
import { errorMessage } from "../lib/errors";

export function useSportCatalog() {
  return useQuery(api.sportCatalog.list);
}

export function SportCatalog() {
  const sports = useSportCatalog();
  const save = useMutation(api.sportCatalog.save);
  const deleteCategory = useMutation(api.sportCatalog.deleteCategory);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const sport = sports?.find(s => s.code === selected);
  const preview = useQuery(api.sportCatalog.migrationPreview, sport ? { code: sport.code } : "skip");
  const [pending, setPending] = useState<FunctionArgs<typeof api.sportCatalog.save> | null>(null);
  const [oldCategory, setOldCategory] = useState("");
  async function removeCategory(name: string) {
    if (!sport) return;
    setBusy(true); setMessage("");
    try {
      await deleteCategory({ code: sport.code, name });
      setFailed(false); setMessage(`Deleted unused category “${name}”.`);
      setPending(null); setOldCategory("");
    } catch (error) { setFailed(true); setMessage(errorMessage(error, "Delete category")); }
    finally { setBusy(false); }
  }
  async function apply(args: FunctionArgs<typeof api.sportCatalog.save>) {
    setBusy(true); setMessage("");
    try {
      const affected = await save(args);
      setFailed(false); setMessage(`Saved. ${affected} linked registration${affected === 1 ? "" : "s"} updated together.`);
      setSelected(args.code.trim().toUpperCase()); setPending(null); setOldCategory("");
    } catch (error) { setFailed(true); setMessage(errorMessage(error, "Save sport catalog")); }
    finally { setBusy(false); }
  }
  async function submit(e: FormEvent<HTMLFormElement>, oldCategory?: string, categoryOnly = false) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const args = {
      code: sport?.code ?? String(data.get("code")), expectedName: sport?.name,
      name: categoryOnly ? sport!.name : String(data.get("name")),
      thai: categoryOnly ? sport!.thai : String(data.get("thai")),
      category: categoryOnly ? { oldName: oldCategory, name: String(data.get("category")) } : undefined,
    };
    if (sport && (args.name.trim() !== sport.name || oldCategory)) setPending(args);
    else { await apply(args); if (categoryOnly) form.reset(); }
  }

  return <section className="content-card sport-catalog">
    <h2>Sports & categories</h2>
    <p>Manage sports and their event categories. Renaming a sport or category updates every linked athlete registration at the same time.</p>
    {message && <div role={failed ? "alert" : "status"} className={`notice notice--${failed ? "error" : "success"}`}>{message}</div>}
    {pending && <div className="notice notice--info" role="region" aria-label="Migration preview"><h3>Review migration</h3><p><strong>Old value:</strong> {pending.category?.oldName ?? pending.expectedName}<br/><strong>New value:</strong> {pending.category?.name ?? pending.name}</p><p>{pending.category ? preview?.categories.find(c => c.name === pending.category?.oldName)?.participants ?? 0 : preview?.participants ?? 0} linked registrations will use the new value. Old inputs will resolve to the new value. Existing signatures, signer names, and signing dates will be preserved. Participants do not need to sign again.</p><button className="button button--primary" disabled={busy || !preview} onClick={() => void apply(pending)}>{busy ? "Migrating…" : "Apply migration"}</button> <button className="button button--ghost" disabled={busy} onClick={() => setPending(null)}>Cancel</button></div>}
    {!sports ? <p role="status">Loading sports…</p> : <>
      <div className="field"><label htmlFor="manage-sport">Sport</label><select id="manage-sport" className="select" value={selected} disabled={busy} onChange={e => { setSelected(e.target.value); setMessage(""); setPending(null); setOldCategory(""); }}><option value="">Add a new sport</option>{sports.map(s => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}</select></div>
      <form key={`${sport?.code}:${sport?.name}:${sport?.thai}`} onSubmit={e => void submit(e)}>
        <fieldset disabled={busy} className="sport-catalog__fields">
          <div className="form-grid">
            <div className="field"><label htmlFor="sport-code">Sport code</label><input id="sport-code" className="input" name="code" required maxLength={100} readOnly={!!sport} defaultValue={sport?.code}/></div>
            <div className="field"><label htmlFor="sport-name">Sport name</label><input id="sport-name" className="input" name="name" required maxLength={100} defaultValue={sport?.name}/></div>
            <div className="field"><label htmlFor="sport-thai">Thai name</label><input id="sport-thai" className="input" name="thai" maxLength={100} defaultValue={sport?.thai}/></div>
          </div>
          <button className="button button--primary">{busy ? "Saving…" : sport ? "Save sport" : "Create sport"}</button>
        </fieldset>
      </form>
      {sport && <><h3>Migrate an old category</h3><p>Choose an existing value, including categories from older imports. Enter a new name or an existing category to combine them.</p><form className="sport-catalog__event" onSubmit={e => void submit(e, oldCategory, true)}><label className="field">Old value<select className="select" required value={oldCategory} disabled={busy || !preview} onChange={e => setOldCategory(e.target.value)}><option value="">Choose old category</option>{preview?.categories.map(c => <option key={c.name} value={c.name}>{c.name} ({c.participants} registrations)</option>)}</select></label><label className="field">New value<input className="input" name="category" required maxLength={100} list="migration-targets" disabled={busy}/><datalist id="migration-targets">{sport.types.map(name => <option key={name} value={name}/>)}</datalist></label><button className="button button--primary" disabled={busy || !oldCategory}>Preview migration</button></form><h3>Event categories</h3><p>Categories belong to this sport. The same category name in another sport is unaffected. Only unused categories can be deleted; migrate linked participants first.</p>
        {sport.events.map(event => {
          const names = new Set([event.name, ...event.aliases].map(name => name.trim().toLowerCase()));
          const inUse = preview?.categories.some(c => names.has(c.name.trim().toLowerCase()) && c.participants > 0);
          return <form key={`${sport.code}:${event.name}`} className="sport-catalog__event" onSubmit={e => void submit(e, event.name, true)}><label className="field">Category name<input aria-label={`Rename ${event.name}`} className="input" name="category" required maxLength={100} disabled={busy} defaultValue={event.name}/></label><button className="button button--soft" disabled={busy}>Save category</button><button type="button" className="button button--danger" disabled={busy || !preview || inUse} aria-label={`Delete ${event.name}`} title={inUse ? "Migrate linked participants before deleting" : "Delete unused category"} onClick={() => void removeCategory(event.name)}>Delete</button></form>;
        })}
        <form key={sport.code} className="sport-catalog__event" onSubmit={e => void submit(e, undefined, true)}><label className="field">New category<input className="input" name="category" required maxLength={100} disabled={busy} placeholder="e.g. Mixed Doubles"/></label><button className="button button--primary" disabled={busy}>Add category</button></form>
        <h3>Migration history</h3>{preview?.history.length ? <div style={{overflowX: "auto"}}><table className="staff-list"><thead><tr><th>Old value</th><th>New value</th><th>Records updated</th><th>Applied</th></tr></thead><tbody>{preview.history.map(row => <tr key={row._id}><td>{row.oldValue}</td><td>{row.newValue}</td><td>{row.affected}</td><td>{new Date(row.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <p>No migrations yet.</p>}
      </>}
    </>}
  </section>;
}
