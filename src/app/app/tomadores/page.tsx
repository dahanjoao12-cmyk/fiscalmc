import { CustomerManager } from "@/components/customer-manager";import { requireClientPageSession } from "@/lib/auth/session";
export default async function CustomersPage(){await requireClientPageSession();return <div className="page"><div className="page-heading"><div><h1>Tomadores</h1><p>Cadastre e localize os clientes da sua empresa.</p></div></div><CustomerManager/></div>}
