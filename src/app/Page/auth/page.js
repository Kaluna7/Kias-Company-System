import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import AuthPageShell from "./_components/AuthPageShell";

function resolveCallbackUrl(raw) {
  const fallback = "/Page/dashboard";
  if (!raw || typeof raw !== "string") return fallback;
  try {
    const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const url = new URL(raw, base);
    if (url.origin !== new URL(base).origin) return fallback;
    return `${url.pathname}${url.search}` || fallback;
  } catch {
    return fallback;
  }
}

export default async function AuthPage({ searchParams }) {
  const params = await searchParams;

  if (params?.email || params?.password) {
    redirect("/");
  }

  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect(resolveCallbackUrl(params?.callbackUrl));
  }

  return <AuthPageShell callbackUrl={resolveCallbackUrl(params?.callbackUrl)} />;
}
