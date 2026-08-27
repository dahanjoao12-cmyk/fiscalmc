import { AppShell } from "@/components/app-shell";

export default function ClientAreaLayout({children}:{children:React.ReactNode}){
  return <AppShell>{children}</AppShell>;
}
