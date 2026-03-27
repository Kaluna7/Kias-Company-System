import { loadRiskData } from "../loadRiskData";
import OpsClient from "./OpsClient";

export default async function OpsPage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const { initialData, initialMeta } = await loadRiskData("ops", "published", year);
  return <OpsClient initialData={initialData} initialMeta={initialMeta} />;
}
