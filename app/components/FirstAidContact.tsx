import { Phone } from "lucide-react";

export const FIRST_AID_CONTACT = { phone: "0951594516", display: "095-159-4516", name: "T", role: "President CICM" };
export const FIRST_AID_CONTACT_TEXT = `หากมีปัญหา ติดต่อ ${FIRST_AID_CONTACT.display} (${FIRST_AID_CONTACT.name}) ${FIRST_AID_CONTACT.role}`;

/** Who to call when a kit is missing or the log is wrong; shown on every public first aid page. */
export function FirstAidContact() {
  return <p className="kit-contact"><Phone size={15} aria-hidden /><span>หากมีปัญหา ติดต่อ <a href={`tel:${FIRST_AID_CONTACT.phone}`}>{FIRST_AID_CONTACT.display}</a> ({FIRST_AID_CONTACT.name}) {FIRST_AID_CONTACT.role}<br />If there is a problem, contact {FIRST_AID_CONTACT.name}, {FIRST_AID_CONTACT.role}.</span></p>;
}
