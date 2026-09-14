export type ParticipantKind = "athlete" | "performer" | "support";
export const SUPPORT_TYPES = ["Camera", "Support team"];
export function participantKind(p: {participantKind?: ParticipantKind; performerType?: string; sport?: string; category?: string | null}): ParticipantKind {
  if (p.participantKind === "support" || p.sport?.trim().toLowerCase() === "support team" || ((p.performerType === "Parade" || p.sport === "Parade") && SUPPORT_TYPES.some(type => type.toLowerCase() === p.category?.trim().toLowerCase()))) return "support";
  return p.participantKind ?? "athlete";
}
export const kindLabel = {athlete: "Athlete", performer: "Performer", support: "Support team"};

export const PARADE_TYPES = [
  "ผู้เข้าร่วมขบวนการแสดง",
  "คณะทํางานร่วมขบวน",
  "ช่างภาพและผู้ติดตาม",
  "พยานจับเวลา",
  "พยานเสียง",
  "คนพากย์",
  "คนให้สัญญาณป้ายกํากับเวลา",
] as const;
