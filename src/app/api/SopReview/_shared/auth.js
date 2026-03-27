import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * Hanya izinkan user dengan role "reviewer" untuk melakukan perubahan data SOP Review.
 * Kembalikan NextResponse error jika:
 * - belum login, atau
 * - role bukan reviewer.
 *
 * Pemakaian di route:
 *   const authError = await requireReviewer();
 *   if (authError) return authError;
 */
export async function requireReviewer() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user?.role || "").toLowerCase();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (role !== "reviewer") {
      return NextResponse.json(
        { success: false, error: "Forbidden: reviewer only" },
        { status: 403 }
      );
    }

    // null artinya OK, lanjutkan handler
    return null;
  } catch (err) {
    console.error("requireReviewer error:", err);
    return NextResponse.json(
      { success: false, error: "Auth error" },
      { status: 500 }
    );
  }
}

/**
 * Izinkan editor SOP (preparer/reviewer/admin) mengubah draft:
 * - role "user"  (preparer)
 * - role "reviewer"
 * - role "admin" (jika ada)
 *
 * Digunakan untuk: simpan langkah SOP, meta (preparer/reviewer), audit period, dsb.
 * Publish final report tetap memakai requireReviewer().
 */
export async function requireSopEditor() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user?.role || "").toLowerCase();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (role !== "reviewer" && role !== "user" && role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden: SOP editor only" },
        { status: 403 }
      );
    }

    return null;
  } catch (err) {
    console.error("requireSopEditor error:", err);
    return NextResponse.json(
      { success: false, error: "Auth error" },
      { status: 500 }
    );
  }
}


