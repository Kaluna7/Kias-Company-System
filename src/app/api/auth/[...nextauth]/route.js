// src/app/api/auth/[...nextauth]/route.js
export const runtime = "nodejs";

import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

/**
 * Pool and bcrypt are lazy-loaded only in authorize() so GET /api/auth/session
 * stays fast (no DB or native module load on session check).
 */
async function authorize(credentials) {
  try {
    if (!credentials) return null;

    const email = (credentials.email || "").toLowerCase().trim();
    const password = (credentials.password || "").trim();
    if (!email || !password) return null;

    const [{ default: pool }, bcrypt] = await Promise.all([
      import("@/app/lib/db"),
      import("bcryptjs"),
    ]);

    const res = await pool.query(
      `SELECT id, name, email, password_hash, role FROM public.users WHERE email = $1 LIMIT 1`,
      [email]
    );
    const user = res.rows[0];
    if (!user) return null;

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return null;

    return { id: user.id, name: user.name, email: user.email, role: user.role };
  } catch (err) {
    console.error("[AUTH] authorize error:", err);
    return null;
  }
}

/**
 * Export authOptions if you want to import it elsewhere (e.g. getServerSession)
 */
export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize,
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.name = user.name;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = session.user || {};
      session.user.name = token.name ?? session.user.name;
      session.user.email = token.email ?? session.user.email;
      session.user.role = token.role ?? session.user.role;
      return session;
    },
  },

  pages: {
    signIn: "/Page/auth", // your app-router login path (adjust if needed)
  },

  secret: process.env.NEXTAUTH_SECRET,
};

// Create NextAuth handler
const handler = NextAuth(authOptions);

// Export for App Router: named exports for the HTTP methods Next needs
export { handler as GET, handler as POST };
