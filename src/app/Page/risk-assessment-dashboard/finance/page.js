import { loadRiskData } from "../loadRiskData";
import FinanceClient from "./FinanceClient";

export const dynamic = "force-dynamic";

export default async function FinancePage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const { initialData, initialMeta } = await loadRiskData("finance", "published", year);
  return <FinanceClient initialData={initialData} initialMeta={initialMeta} />;
}
