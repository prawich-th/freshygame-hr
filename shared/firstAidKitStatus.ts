type PublicKit = {
  number: number;
  label: string;
  missingSince: number | null;
  current: { name: string; nickname: string; faculty: string; phone: string; sport: string; borrowedAt: number } | null;
};

const iso = (value: number) => new Date(value).toISOString();

/** Plain JSON summary of every kit for agents and scripts, built from the public kit status. */
export function kitStatusReport(kits: PublicKit[], now = Date.now()) {
  const status = (kit: PublicKit) => kit.missingSince !== null ? "missing" : kit.current ? "checked_out" : "available";
  return {
    generatedAt: iso(now),
    total: kits.length,
    available: kits.filter(kit => status(kit) === "available").length,
    checkedOut: kits.filter(kit => status(kit) === "checked_out").length,
    missing: kits.filter(kit => status(kit) === "missing").length,
    kits: kits.map(kit => ({
      number: kit.number,
      label: kit.label,
      status: status(kit),
      missingSince: kit.missingSince === null ? null : iso(kit.missingSince),
      holder: kit.current ? {
        name: kit.current.name, nickname: kit.current.nickname, faculty: kit.current.faculty, phone: kit.current.phone,
        sport: kit.current.sport, borrowedAt: iso(kit.current.borrowedAt),
      } : null,
    })),
  };
}
