import { loadRiskData } from "../loadRiskData";
import SdpClient from "./SdpClient";

export default async function SDPPage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const { initialData, initialMeta } = await loadRiskData("sdp", "published", year);
  return <SdpClient initialData={initialData} initialMeta={initialMeta} />;
}
