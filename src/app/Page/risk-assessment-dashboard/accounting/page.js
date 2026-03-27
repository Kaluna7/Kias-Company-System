import { loadRiskData } from "../loadRiskData";
import AccountingClient from "./AccountingClient";

export default async function AccountingPage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const { initialData, initialMeta } = await loadRiskData("accounting", "published", year);
  return <AccountingClient initialData={initialData} initialMeta={initialMeta} />;
}
