import { loadRiskData } from "../loadRiskData";
import TaxClient from "./TaxClient";

export default async function TaxPage() {
  const { initialData, initialMeta } = await loadRiskData("tax", "published");
  return <TaxClient initialData={initialData} initialMeta={initialMeta} />;
}
