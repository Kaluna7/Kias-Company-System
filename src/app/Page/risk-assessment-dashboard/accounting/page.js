import { loadRiskData } from "../loadRiskData";
import AccountingClient from "./AccountingClient";

export default async function AccountingPage() {
  const { initialData, initialMeta } = await loadRiskData("accounting", "published");
  return <AccountingClient initialData={initialData} initialMeta={initialMeta} />;
}
