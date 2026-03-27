import { GET as baseGET, POST as basePOST } from "../[dept]/route";

export async function GET(req) {
  return baseGET(req, { params: Promise.resolve({ dept: "accounting" }) });
}

export async function POST(req) {
  return basePOST(req, { params: Promise.resolve({ dept: "accounting" }) });
}

