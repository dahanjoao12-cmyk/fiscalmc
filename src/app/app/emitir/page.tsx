import { AppShell } from "@/components/app-shell";
import { MockBanner } from "@/components/mock-banner";
import { IssueWizard } from "@/components/issue-wizard";
export const metadata = { title: "Emitir NFS-e" };
export default function IssuePage() { return <AppShell active="issue"><div className="page"><MockBanner/><div className="page-heading"><div><h1>Emitir NFS-e</h1><p>Informe apenas os dados da operação.</p></div></div><IssueWizard/></div></AppShell>; }
