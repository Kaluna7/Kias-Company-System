import { loadRiskData } from "../loadRiskData";
import OpsClient from "./OpsClient";

export default async function OpsPage() {
  const { initialData, initialMeta } = await loadRiskData("ops", "published");
  return <OpsClient initialData={initialData} initialMeta={initialMeta} />;
}
