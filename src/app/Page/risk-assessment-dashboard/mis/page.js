import { loadRiskData } from "../loadRiskData";
import MisClient from "./MisClient";

export default async function MisPage() {
  const { initialData, initialMeta } = await loadRiskData("mis", "published");
  return <MisClient initialData={initialData} initialMeta={initialMeta} />;
}
