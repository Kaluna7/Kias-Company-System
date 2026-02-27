import { loadRiskData } from "../loadRiskData";
import HrdClient from "./HrdClient";

export default async function HrdPage() {
  const { initialData, initialMeta } = await loadRiskData("hrd", "published");
  return <HrdClient initialData={initialData} initialMeta={initialMeta} />;
}
