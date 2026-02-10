import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";

// Global OTP store - use globalThis to persist across hot reloads
// In production, use Redis or database
declare global {
  var otpStore: Map<string, { code: string; expires: number }> | undefined;
}

// Initialize or reuse the global OTP store
const otpStore = globalThis.otpStore ?? new Map<string, { code: string; expires: number }>();
globalThis.otpStore = otpStore;

// Verify OAuth credentials are present (no values logged)
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn("[Auth Config] Google OAuth credentials not configured");
}

export const authOptions: NextAuthOptions = {
  // Enable debug mode in development
  debug: process.env.NODE_ENV === "development",

  // Custom logger to capture OAuth errors
  logger: {
    error(code, metadata) {
      console.error("[NextAuth Error]", code, JSON.stringify(metadata, null, 2));
    },
    warn(code) {
      console.warn("[NextAuth Warn]", code);
    },
    debug(code, metadata) {
      console.log("[NextAuth Debug]", code, metadata);
    },
  },

  providers: [
    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),

    // Microsoft Azure AD OAuth
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID || "",
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET || "",
      tenantId: process.env.AZURE_AD_TENANT_ID || "common",
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
          console.log("[OTP Auth] Missing credentials");
          return null;
        }

        const email = credentials.email.toLowerCase().trim();
        const enteredOtp = String(credentials.otp).trim();
        const stored = otpStore.get(email);

        console.log("[OTP Auth] Validating:", {
          email,
          enteredOtp,
          hasStored: !!stored,
          storedCode: stored?.code,
          expired: stored ? stored.expires < Date.now() : null,
          storeSize: otpStore.size,
          allKeys: Array.from(otpStore.keys())
        });

        if (!stored) {
          console.log("[OTP Auth] No stored OTP found for email");
          return null;
        }

        // Check if OTP matches and hasn't expired
        const isMatch = stored.code === enteredOtp;
        const isValid = stored.expires > Date.now();

        console.log("[OTP Auth] Comparison:", {
          isMatch,
          isValid,
          storedCode: stored.code,
          enteredCode: enteredOtp,
          expiresIn: Math.round((stored.expires - Date.now()) / 1000) + "s"
        });

        if (isMatch && isValid) {
          otpStore.delete(email);
          console.log("[OTP Auth] Success! User authenticated:", email);
          return {
            id: email,
            email: email,
            name: email.split("@")[0],
          };
        }

        console.log("[OTP Auth] Failed - match:", isMatch, "valid:", isValid);
        return null;
      },
    }),
  ],

  pages: {
    signIn: "/", // Use custom modal on landing page
    error: "/",
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      console.log("[NextAuth] SignIn callback:", {
        provider: account?.provider,
        email: user?.email,
        name: user?.name
      });
      return true;
    },
    async redirect({ url, baseUrl }) {
      console.log("[NextAuth] Redirect callback:", { url, baseUrl });
      // Handle relative URLs (e.g., "/dashboard")
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      // Handle absolute URLs on same origin
      if (url.startsWith(baseUrl)) {
        return url;
      }
      // Default: redirect to dashboard
      return `${baseUrl}/dashboard`;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      // Capture the OAuth access token on initial sign-in
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      // Expose accessToken to the client session for API calls
      (session as unknown as Record<string, unknown>).accessToken = token.accessToken;
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
  const normalizedEmail = email.toLowerCase().trim();
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore.set(normalizedEmail, {
    code,
    expires: Date.now() + 10 * 60 * 1000, // 10 minutes
  });

  console.log("[OTP] Generated for", normalizedEmail, ":", code, "| Store size:", otpStore.size);

  return code;
}

// Helper to verify OTP exists (for UI feedback)
export function hasValidOTP(email: string): boolean {
  const stored = otpStore.get(email.toLowerCase().trim());
  return !!stored && stored.expires > Date.now();
}

// Debug helper - list all OTPs (dev only)
export function debugOTPStore(): void {
  console.log("[OTP Store] Current entries:");
  otpStore.forEach((value, key) => {
    console.log(`  ${key}: ${value.code} (expires in ${Math.round((value.expires - Date.now()) / 1000)}s)`);
  });
}
