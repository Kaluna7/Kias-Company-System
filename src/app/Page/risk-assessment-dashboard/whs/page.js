import { loadRiskData } from "../loadRiskData";
import WhsClient from "./WhsClient";

export default async function WhsPage() {
  const { initialData, initialMeta } = await loadRiskData("whs", "published");
  return <WhsClient initialData={initialData} initialMeta={initialMeta} />;
}
