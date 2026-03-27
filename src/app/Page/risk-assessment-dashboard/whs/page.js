import { loadRiskData } from "../loadRiskData";
import WhsClient from "./WhsClient";

export const dynamic = "force-dynamic";

export default async function WhsPage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const { initialData, initialMeta } = await loadRiskData("whs", "published", year);
  return <WhsClient initialData={initialData} initialMeta={initialMeta} />;
}
