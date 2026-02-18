import { NextAuthOptions, CookieOption } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";

const useSecureCookies = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");

// Explicit cookie config for Cloud Run (.run.app is a public suffix domain).
// All OAuth-flow cookies (state, pkce, nonce) must be explicitly configured
// to prevent "State cookie was missing" errors on the OAuth callback.
const cookiePrefix = useSecureCookies ? "__Secure-" : "";
const baseCookieOpts = { httpOnly: true, sameSite: "lax" as const, path: "/", secure: useSecureCookies };
const cookieOptions: Partial<Record<string, CookieOption>> = {
  sessionToken: {
    name: `${cookiePrefix}next-auth.session-token`,
    options: baseCookieOpts,
  },
  callbackUrl: {
    name: `${cookiePrefix}next-auth.callback-url`,
    options: baseCookieOpts,
  },
  csrfToken: {
    name: `${useSecureCookies ? "__Host-" : ""}next-auth.csrf-token`,
    options: baseCookieOpts,
  },
  state: {
    name: `${cookiePrefix}next-auth.state`,
    options: { ...baseCookieOpts, maxAge: 900 },
  },
  pkceCodeVerifier: {
    name: `${cookiePrefix}next-auth.pkce.code_verifier`,
    options: { ...baseCookieOpts, maxAge: 900 },
  },
  nonce: {
    name: `${cookiePrefix}next-auth.nonce`,
    options: { ...baseCookieOpts, maxAge: 900 },
  },
};

// Global OTP store - use globalThis to persist across hot reloads
// In production, use Redis or database
declare global {
  var otpStore: Map<string, { code: string; expires: number }> | undefined;
}

// Initialize or reuse the global OTP store
const otpStore = globalThis.otpStore ?? new Map<string, { code: string; expires: number }>();
globalThis.otpStore = otpStore;

// Verify OAuth credentials are present (no values logged)
if (process.env.NODE_ENV === "development" && (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)) {
  console.warn("[Auth Config] Google OAuth credentials not configured");
}

export const authOptions: NextAuthOptions = {
  // Enable debug mode to capture OAuth errors in Cloud Run logs
  debug: true,

  // Logger: always log errors so Cloud Run logs capture OAuth failures
  logger: {
    error(code, metadata) {
      console.error("[NextAuth Error]", code, JSON.stringify(metadata, null, 2));
    },
    warn(code) {
      console.warn("[NextAuth Warn]", code);
    },
    debug(code, metadata) {
      if (process.env.NODE_ENV === "development") {
        console.debug("[NextAuth Debug]", code, metadata);
      }
    },
  },

  providers: [
    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
              scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.labels",
          access_type: "offline",
          prompt: "consent",
          response_type: "code",
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
          return null;
        }

        const email = credentials.email.toLowerCase().trim();
        const enteredOtp = String(credentials.otp).trim();
        const stored = otpStore.get(email);

        if (!stored) {
          return null;
        }

        // Check if OTP matches and hasn't expired
        const isMatch = stored.code === enteredOtp;
        const isValid = stored.expires > Date.now();

        if (isMatch && isValid) {
          otpStore.delete(email);
          return {
            id: email,
            email: email,
            name: email.split("@")[0],
          };
        }

        return null;
      },
    }),
  ],

  cookies: cookieOptions,

  pages: {
    signIn: "/", // Use custom modal on landing page
    error: "/",
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      return true;
    },
    async redirect({ url, baseUrl }) {
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
      // Capture OAuth tokens on initial sign-in
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : 0;
        token.provider = account.provider;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      // Expose tokens to the client session for API calls
      const ext = session as unknown as Record<string, unknown>;
      ext.accessToken = token.accessToken;
      ext.refreshToken = token.refreshToken;
      ext.provider = token.provider;
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

  return code;
}

// Helper to verify OTP exists (for UI feedback)
export function hasValidOTP(email: string): boolean {
  const stored = otpStore.get(email.toLowerCase().trim());
  return !!stored && stored.expires > Date.now();
}

// Debug helper - list all OTPs (dev only, never logs secrets in production)
export function debugOTPStore(): void {
  if (process.env.NODE_ENV !== "development") return;
  console.log("[OTP Store] entry count:", otpStore.size);
}
