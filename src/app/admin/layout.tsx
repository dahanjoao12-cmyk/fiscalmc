import { AppShell } from "@/components/app-shell";

export default function OfficeAreaLayout({children}:{children:React.ReactNode}){
  return <AppShell admin>{children}</AppShell>;
}
