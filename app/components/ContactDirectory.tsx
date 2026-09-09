"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "convex/react";
import { Search, Phone, Mail, UsersRound } from "lucide-react";
import { api } from "@/convex/_generated/api";

export function ContactDirectory() {
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const result = useQuery(api.directory.search, term ? { term } : "skip");
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTerm(input.trim());
  }
  return <section className="contact-directory">
    <div className="contact-directory__toolbar">
    <div className="contact-directory__intro"><span className="eyebrow">BROWN TEAM · FRESHY GAME 2026</span><h2>Find your people</h2><p>Look up participants by name, nickname, phone, email, faculty, or sport.</p></div>
    <form className="contact-directory__search" onSubmit={search} role="search">
      <label htmlFor="directory-search">Search contacts</label>
      <div><input id="directory-search" className="input" type="search" placeholder="Name, nickname, or contact…" value={input} onChange={e => { setInput(e.target.value); if (!e.target.value.trim()) setTerm(""); }} minLength={2} maxLength={100} required enterKeyHint="search"/><button className="button button--primary" disabled={input.trim().length < 2}><Search size={18}/>Search</button></div>
    </form>
    </div>
    <div aria-live="polite" role="status" className="contact-directory__status">{!term ? "Enter at least 2 characters to find a contact." : !result ? "Searching contacts…" : result.hasMore ? "Showing 25 matches. Use a more specific search to narrow the results." : `${result.contacts.length} ${result.contacts.length === 1 ? "contact" : "contacts"} found for “${term}”`}</div>
    {!term && <div className="contact-directory__empty"><UsersRound size={36}/><h3>Your team, a search away</h3><p>Contact details and team information in one place.</p></div>}
    {term && result?.contacts.length === 0 && <div className="contact-directory__empty"><Search size={32}/><h3>No contacts found</h3><p>Try a different spelling, nickname, or sport.</p></div>}
    <div className="contact-directory__grid">{result && term && result.contacts.map(p => <article className="contact-card" key={p._id}>
      <div className="contact-card__heading"><span className="contact-card__avatar" aria-hidden="true">{(p.fullNameEnglish || p.fullNameThai).slice(0, 1)}</span><div><h3>{p.fullNameThai || p.fullNameEnglish}</h3>{p.fullNameThai && <p>{p.fullNameEnglish}</p>}{(p.nicknameThai || p.nicknameEnglish) && <p>{[p.nicknameThai, p.nicknameEnglish].filter(Boolean).join(" · ")}</p>}</div></div>
      <dl><div><dt>Faculty</dt><dd>{p.faculty || "Not provided"}</dd></div><div><dt>Team / sport</dt><dd>{p.sport || "Not provided"}</dd></div><div><dt>Types</dt><dd>{(p.categories ?? [p.category]).filter(Boolean).join(" · ") || "Not provided"}</dd></div><div><dt>Participant</dt><dd>{p.participantKind}</dd></div><div><dt>Phone</dt><dd>{p.phone ? <a href={`tel:${p.phone.replace(/[^+\d]/g, "")}`}>{p.phone}</a> : "Not provided"}</dd></div><div><dt>Email</dt><dd>{p.email ? <a href={`mailto:${p.email}`}>{p.email}</a> : "Not provided"}</dd></div><div><dt>LINE ID</dt><dd>{p.lineId || "Not provided"}</dd></div><div><dt>Instagram</dt><dd>{p.instagram || "Not provided"}</dd></div>{p.preferredContact && <div><dt>Preferred contact</dt><dd>{p.preferredContact}</dd></div>}</dl>
      {(p.phone || p.email) && <div className="contact-card__actions">{p.phone && <a className="button button--primary" href={`tel:${p.phone.replace(/[^+\d]/g, "")}`}><Phone size={16}/>Call</a>}{p.email && <a className="button button--soft" href={`mailto:${p.email}`}><Mail size={16}/>Email</a>}</div>}
    </article>)}</div>
  </section>;
}
