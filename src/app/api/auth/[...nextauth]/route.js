// src/app/api/auth/[...nextauth]/route.js
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import pool from "@/app/lib/db";
import bcrypt from "bcryptjs";

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
      async authorize(credentials) {
        try {
          if (!credentials) {
            console.log("[AUTH DEBUG] no credentials provided");
            return null;
          }
      
          // Trim and normalize input (common cause: trailing spaces)
          const email = (credentials.email || "").toLowerCase().trim();
          const password = (credentials.password || "").trim();
      
          console.log("[AUTH DEBUG] login attempt for:", email);
      
          const res = await pool.query(
            `SELECT id, name, email, password_hash, role FROM public.users WHERE email = $1 LIMIT 1`,
            [email]
          );
          const user = res.rows[0];
      
          console.log("[AUTH DEBUG] user found:", !!user, user ? { id: user.id, email: user.email, role: user.role } : null);
      
          if (!user) {
            // helpful message for logs — not returned to client
            console.log("[AUTH DEBUG] authorize -> user not found");
            return null;
          }
      
          // compare passwords
          const valid = await bcrypt.compare(password, user.password_hash);
          console.log("[AUTH DEBUG] password compare result:", valid);
      
          if (!valid) {
            console.log("[AUTH DEBUG] authorize -> invalid password for:", email);
            return null;
          }
      
          // ok — successful
          console.log("[AUTH DEBUG] authorize -> success for:", email);
          return { id: user.id, name: user.name, email: user.email, role: user.role };
        } catch (err) {
          console.error("[AUTH DEBUG] authorize error:", err);
          return null;
        }
      },      
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
