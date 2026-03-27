import { loadRiskData } from "../loadRiskData";
import GaClient from "./GaClient";

export const dynamic = "force-dynamic";

export default async function GaPage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const { initialData, initialMeta } = await loadRiskData("g&a", "published", year);
  return <GaClient initialData={initialData} initialMeta={initialMeta} />;
}
