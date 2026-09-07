export const SPORTS = [
  { code: "VB", name: "Volleyball", thai: "วอลเลย์บอล", types: ["Team"] },
  { code: "BB", name: "Basketball", thai: "บาสเกตบอล", types: ["Team"] },
  { code: "FB", name: "Football", thai: "ฟุตบอล", types: ["Team"] },
  { code: "ES", name: "E-Sports", thai: "กีฬาอิเล็กทรอนิกส์", types: ["Team — Arena of Valor (RoV)"] },
  { code: "PT", name: "Petanque", thai: "เปตอง", types: ["Team"] },
  { code: "DS", name: "DanceSport", thai: "ลีลาศ", types: ["Beguine Solo", "Waltz Solo", "Tango Solo", "Cha-cha-cha Solo", "Rumba Solo"] },
  { code: "BD", name: "Badminton", thai: "แบดมินตัน", types: ["Singles", "Doubles", "Mixed Doubles"] },
  { code: "TT", name: "Table Tennis", thai: "เทเบิลเทนนิส", types: ["Singles", "Team"] },
  { code: "AR", name: "Archery", thai: "ยิงธนู", types: ["Individual — Barebow 10 m"] },
  { code: "TK", name: "Taekwondo", thai: "เทควันโด", types: ["Combat — By weight class"] },
  { code: "BX", name: "Amateur Boxing", thai: "มวยสากล", types: ["Individual — By weight class"] },
  { code: "FE", name: "Fencing", thai: "ฟันดาบสากล", types: ["Épée — Individual"] },
  { code: "SW", name: "Swimming", thai: "กีฬาทางน้ำ (ว่ายน้ำ)", types: ["50 m Freestyle", "50 m Backstroke", "50 m Breaststroke", "50 m Butterfly", "Freestyle Relay", "Breaststroke Relay"] },
  { code: "AT", name: "Athletics", thai: "กรีฑา", types: ["100 m", "200 m", "400 m", "800 m", "5 × 80 m Relay", "4 × 100 m Relay", "4 × 400 m Relay"] },
];

export function findSport(value: string) {
  const normalized = value.trim().toLowerCase();
  return SPORTS.find(s => [s.code, s.name, s.thai, `${s.thai} / ${s.name}`].some(alias => alias.toLowerCase() === normalized));
}

// Keep free-form CSV types (including weight classes) while resolving sport codes.
export function normalizeSport(value: string) {
  return findSport(value)?.name ?? value.trim();
}
