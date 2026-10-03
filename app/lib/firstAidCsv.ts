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
