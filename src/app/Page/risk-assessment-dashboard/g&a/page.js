import { loadRiskData } from "../loadRiskData";
import GaClient from "./GaClient";

export default async function GaPage() {
  const { initialData, initialMeta } = await loadRiskData("g&a", "published");
  return <GaClient initialData={initialData} initialMeta={initialMeta} />;
}
