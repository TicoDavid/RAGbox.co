import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

// For demo purposes, we'll use a simple in-memory OTP store
// In production, use Redis or database
const otpStore = new Map<string, { code: string; expires: number }>();

export const authOptions: NextAuthOptions = {
  providers: [
    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),

    // Email OTP (Credentials-based for custom UI)
    CredentialsProvider({
      id: "email-otp",
      name: "Email OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        otp: { label: "OTP", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.otp) {
          return null;
        }

        const stored = otpStore.get(credentials.email);
        if (!stored) {
          return null;
        }

        // Check if OTP matches and hasn't expired
        if (stored.code === credentials.otp && stored.expires > Date.now()) {
          otpStore.delete(credentials.email);
          return {
            id: credentials.email,
            email: credentials.email,
            name: credentials.email.split("@")[0],
          };
        }

        return null;
      },
    }),
  ],

  pages: {
    signIn: "/", // Use custom modal on landing page
    error: "/",
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET,
};

// Helper to generate and store OTP
export function generateOTP(email: string): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(email, {
    code,
    expires: Date.now() + 10 * 60 * 1000, // 10 minutes
  });
  return code;
}

// Helper to verify OTP exists (for UI feedback)
export function hasValidOTP(email: string): boolean {
  const stored = otpStore.get(email);
  return !!stored && stored.expires > Date.now();
}
