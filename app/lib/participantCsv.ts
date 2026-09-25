export type ParticipantContact = {
  studentId: string;
  name: string;
  nickname: string;
  faculty: string;
  tel: string;
  line: string;
  sport: string;
  type: string;
};

function csvCell(value: string) {
  // Prevent participant-entered values from becoming spreadsheet formulas.
  const safe = /^[\s]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function participantCsv(contacts: ParticipantContact[]) {
  // Keep each registration so every sport remains paired with its event types.
  const rows = [...contacts].sort((a, b) => a.studentId.localeCompare(b.studentId) || a.sport.localeCompare(b.sport));
  return "\uFEFF" + [
    ["Name", "Nickname", "Faculty", "Tel", "Line", "Student ID", "Sport", "Type"],
    ...rows.map(p => [p.name, p.nickname, p.faculty, p.tel, p.line, p.studentId, p.sport, p.type]),
  ].map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function downloadParticipantCsv(contacts: ParticipantContact[], kind: "athlete" | "performer") {
  const url = URL.createObjectURL(new Blob([participantCsv(contacts)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `Freshy-Game-${kind}s.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
