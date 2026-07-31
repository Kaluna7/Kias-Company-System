// src/app/api/auth/[...nextauth]/route.js
export const runtime = "nodejs";

import * as NextAuthModule from "next-auth";
import * as CredentialsProviderModule from "next-auth/providers/credentials";

const NextAuth =
  NextAuthModule?.default?.default ||
  NextAuthModule?.default ||
  NextAuthModule;

const CredentialsProvider =
  CredentialsProviderModule?.default?.default ||
  CredentialsProviderModule?.default ||
  CredentialsProviderModule;

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
    // Wrong email: no row. Wrong password: compare fails. NextAuth surfaces this as
    // error "CredentialsSignin" to the client; the login UI maps it to a friendly message.
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

  session: {
    strategy: "jwt",
    // Absolute JWT lifetime; refreshed while the app is open (SessionProvider refetchInterval).
    // Combined with SessionIdleGuard: offline / idle 2 hours → must login again.
    maxAge: 2 * 60 * 60, // 2 hours
    updateAge: 5 * 60, // re-issue token at most every 5 minutes while active
  },

  callbacks: {
    async jwt({ token, user }) {
      const nowSec = Math.floor(Date.now() / 1000);
      const idleLimitSec = 2 * 60 * 60;

      if (user) {
        token.id = String(user.id ?? token.id ?? token.sub ?? "");
        token.sub = String(user.id ?? token.sub ?? "");
        token.email = user.email ?? token.email;
        token.name = user.name;
        token.role = user.role;
        token.lastActiveAt = nowSec;
        return token;
      }

      const last = Number(token.lastActiveAt) || Number(token.iat) || nowSec;
      if (nowSec - last >= idleLimitSec) {
        // Force session invalidation after 2h idle between JWT refreshes
        return {};
      }

      token.lastActiveAt = nowSec;
      return token;
    },
    async session({ session, token }) {
      if (!token || (!token.id && !token.sub && !token.email)) {
        return { ...session, user: null, expires: new Date(0).toISOString() };
      }
      session.user = session.user || {};
      session.user.id = String(token.id ?? token.sub ?? session.user.id ?? "");
      session.user.name = token.name ?? session.user.name;
      session.user.email = token.email ?? session.user.email;
      session.user.role = token.role ?? session.user.role;
      return session;
    },
  },

  pages: {
    signIn: "/",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

// Create NextAuth handler
const handler = NextAuth(authOptions);

// Export for App Router: named exports for the HTTP methods Next needs
export { handler as GET, handler as POST };
