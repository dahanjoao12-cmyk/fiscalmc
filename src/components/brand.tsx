import Image from "next/image";

export function Brand({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  return <div className={`brand${inverse ? " brand-inverse" : ""}${compact ? " brand-compact" : ""}`}>
    <Image className="brand-logo" src="/icon-192.png" width={50} height={50} alt="" priority />
    <span><strong>Moreira &amp; Castro</strong>{compact ? null : <small>Plataforma Fiscal</small>}</span>
  </div>;
}
