import { loadRiskData } from "../loadRiskData";
import SdpClient from "./SdpClient";

export default async function SDPPage() {
  const { initialData, initialMeta } = await loadRiskData("sdp", "published");
  return <SdpClient initialData={initialData} initialMeta={initialMeta} />;
}
