import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {

  return (
    <Link href="/" className={`brand ${compact ? "brand--compact" : ""}`}>
      <span className="brand__mark"><span>FG</span><small>26</small></span>
      <span className="brand__text"><strong>FRESHY GAME</strong><small>HUMAN RESOURCE</small></span>
    </Link>
  );
}

