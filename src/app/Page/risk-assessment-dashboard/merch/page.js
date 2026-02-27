import { loadRiskData } from "../loadRiskData";
import MerchClient from "./MerchClient";

export default async function MerchPage() {
  const { initialData, initialMeta } = await loadRiskData("merch", "published");
  return <MerchClient initialData={initialData} initialMeta={initialMeta} />;
}
