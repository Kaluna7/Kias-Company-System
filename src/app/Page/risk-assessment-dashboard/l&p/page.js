import { loadRiskData } from "../loadRiskData";
import LpClient from "./LpClient";

export default async function LpPage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const { initialData, initialMeta } = await loadRiskData("l&p", "published", year);
  return <LpClient initialData={initialData} initialMeta={initialMeta} />;
}
