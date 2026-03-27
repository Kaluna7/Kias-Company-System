import { loadRiskData } from "../loadRiskData";
import MisClient from "./MisClient";

export default async function MisPage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const { initialData, initialMeta } = await loadRiskData("mis", "published", year);
  return <MisClient initialData={initialData} initialMeta={initialMeta} />;
}
