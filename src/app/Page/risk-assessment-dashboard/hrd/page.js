import { loadRiskData } from "../loadRiskData";
import HrdClient from "./HrdClient";

export const dynamic = "force-dynamic";

export default async function HrdPage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const { initialData, initialMeta } = await loadRiskData("hrd", "published", year);
  return <HrdClient initialData={initialData} initialMeta={initialMeta} />;
}
