import Image from "next/image";

export function Brand() {
  return <div className="brand"><Image className="brand-logo" src="/logo-mc.jpg" width={50} height={50} alt="" priority /><span>Moreira &amp; Castro</span></div>;
}
