import { loadRiskData } from "../loadRiskData";
import TaxClient from "./TaxClient";

export const dynamic = "force-dynamic";

export default async function TaxPage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const { initialData, initialMeta } = await loadRiskData("tax", "published", year);
  return <TaxClient initialData={initialData} initialMeta={initialMeta} />;
}
