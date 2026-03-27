import { loadRiskData } from "../loadRiskData";
import MerchClient from "./MerchClient";

export const dynamic = "force-dynamic";

export default async function MerchPage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const { initialData, initialMeta } = await loadRiskData("merch", "published", year);
  return <MerchClient initialData={initialData} initialMeta={initialMeta} />;
}
