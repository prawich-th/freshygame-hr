export type FirstAidLogRow = {
  kitNumber: number;
  borrowerName: string;
  nickname: string;
  phone: string;
  faculty: string;
  studentId: string;
  sport: string;
  borrowedAt: number;
  returnedAt: number | null;
  returnerName: string;
  note: string;
};

function csvCell(value: string) {
  // Prevent borrower-entered values from becoming spreadsheet formulas.
  const safe = /^[\s]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

const time = (value: number | null) => value === null ? "" : new Date(value).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });

export function firstAidCsv(rows: FirstAidLogRow[]) {
  const sorted = [...rows].sort((a, b) => a.borrowedAt - b.borrowedAt);
  return "﻿" + [
    ["วันที่ยืม", "วันที่คืน", "ชื่อ - สกุล", "ชื่อเล่น", "คณะ", "เบอร์โทร", "รหัสนักศึกษา", "สำหรับกีฬา", "กล่องที่", "ผู้คืน", "หมายเหตุ"],
    ...sorted.map(r => [time(r.borrowedAt), time(r.returnedAt), r.borrowerName, r.nickname, r.faculty, r.phone, r.studentId, r.sport, String(r.kitNumber), r.returnerName, r.note]),
  ].map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function downloadFirstAidCsv(rows: FirstAidLogRow[]) {
  const url = URL.createObjectURL(new Blob([firstAidCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "Freshy-Game-first-aid-kits.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type FirstAidTreatmentRow = {
  sequence: number;
  kitNumber: number;
  treatedAt: number;
  sport: string;
  patientName: string;
  patientStudentId: string;
  patientFaculty: string;
  symptoms: string;
  supplies: string;
  note: string;
  caretakerName: string;
  caretakerStudentId: string;
  caretakerFaculty: string;
};

export const treatmentDate = (value: number) => new Date(value).toLocaleDateString("th-TH", { dateStyle: "medium" });
export const treatmentTime = (value: number) => new Date(value).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

export function treatmentCsv(rows: FirstAidTreatmentRow[]) {
  const sorted = [...rows].sort((a, b) => a.kitNumber - b.kitNumber || a.sequence - b.sequence);
  return "\uFEFF" + [
    ["กล่องที่", "ลำดับ", "วันที่", "เวลา", "กีฬา", "ชื่อ - สกุล", "รหัสนักศึกษา", "คณะ", "อาการ", "ยา / เวชภัณฑ์ ที่ใช้", "หมายเหตุ", "ผู้ดูแล", "รหัสนักศึกษาผู้ดูแล", "คณะผู้ดูแล", "ลงชื่อ"],
    ...sorted.map(r => [String(r.kitNumber), String(r.sequence), treatmentDate(r.treatedAt), treatmentTime(r.treatedAt), r.sport, r.patientName, r.patientStudentId, r.patientFaculty, r.symptoms, r.supplies, r.note, r.caretakerName, r.caretakerStudentId, r.caretakerFaculty, "ลงชื่อแล้วทั้งสองฝ่าย"]),
  ].map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function downloadTreatmentCsv(rows: FirstAidTreatmentRow[]) {
  const url = URL.createObjectURL(new Blob([treatmentCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "Freshy-Game-first-aid-report.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
