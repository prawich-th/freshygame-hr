/** Short faculty codes shown in the first aid kit log, mapped to the Thai names used on participant records. */
export const FACULTIES = [
  { code: "CICM", thai: "วิทยาลัยแพทยศาสตร์นานาชาติจุฬาภรณ์" },
  { code: "MED", thai: "คณะแพทยศาสตร์" },
  { code: "L'ARTs", thai: "คณะศิลปศาสตร์" },
] as const;

export type FacultyCode = typeof FACULTIES[number]["code"];
