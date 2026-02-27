import { loadRiskData } from "../loadRiskData";
import LpClient from "./LpClient";

export default async function LpPage() {
  const { initialData, initialMeta } = await loadRiskData("l&p", "published");
  return <LpClient initialData={initialData} initialMeta={initialMeta} />;
}
