import { loadRiskData } from "../loadRiskData";
import FinanceClient from "./FinanceClient";

export default async function FinancePage() {
  const { initialData, initialMeta } = await loadRiskData("finance", "published");
  return <FinanceClient initialData={initialData} initialMeta={initialMeta} />;
}
