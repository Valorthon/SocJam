import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import type { User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import argon2 from "argon2";
import { z } from "zod";
import { db } from "@/lib/db";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

interface FailedAttempt {
  count: number;
  firstAttempt: number;
}

export type AuthenticatedUserResult =
  | { ok: true; userId: string }
  | { ok: false };

// Demo-scope throttle store; replace with persistent storage before scaling out.
const failedAttempts = new Map<string, FailedAttempt>();
const THROTTLE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;

function checkThrottle(email: string): { throttled: boolean; message?: string } {
  const now = Date.now();
  const record = failedAttempts.get(email);

  if (!record) {
    return { throttled: false };
  }

  if (now - record.firstAttempt > THROTTLE_WINDOW_MS) {
    failedAttempts.delete(email);
    return { throttled: false };
  }

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    const remainingMs = THROTTLE_WINDOW_MS - (now - record.firstAttempt);
    const remainingMin = Math.ceil(remainingMs / 60000);
    return {
      throttled: true,
      message: `Too many attempts. Try again in ${remainingMin} minutes.`,
    };
  }

  return { throttled: false };
}

function recordFailure(email: string): void {
  const now = Date.now();
  const record = failedAttempts.get(email);

  if (!record || now - record.firstAttempt > THROTTLE_WINDOW_MS) {
    failedAttempts.set(email, { count: 1, firstAttempt: now });
  } else {
    record.count += 1;
  }
}

function recordSuccess(email: string): void {
  failedAttempts.delete(email);
}

export function getCredentialsThrottleError(credentials: unknown): string | null {
  const parsed = credentialsSchema.safeParse(credentials);
  if (!parsed.success) {
    return null;
  }

  const throttle = checkThrottle(parsed.data.email.toLowerCase());
  if (throttle.throttled) {
    return throttle.message ?? "Too many attempts. Try again later.";
  }

  return null;
}

export async function authorizeCredentials(
  credentials: unknown,
): Promise<User | null> {
  const parsed = credentialsSchema.safeParse(credentials);
  if (!parsed.success) {
    return null;
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  const throttleError = getCredentialsThrottleError(parsed.data);
  if (throttleError) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || !user.passwordHash) {
    recordFailure(normalizedEmail);
    return null;
  }

  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) {
    recordFailure(normalizedEmail);
    return null;
  }

  recordSuccess(normalizedEmail);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}

export const authConfig = {
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    newUser: "/onboarding",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        return authorizeCredentials(credentials);
      },
    }),
    buildGoogleProvider(),
  ].filter((provider): provider is NonNullable<typeof provider> => provider !== null),
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

function getGoogleCredentials(): {
  clientId: string;
  clientSecret: string;
} | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
}

export function isGoogleOAuthEnabled(): boolean {
  return getGoogleCredentials() !== null;
}

function buildGoogleProvider() {
  const credentials = getGoogleCredentials();
  if (!credentials) {
    return null;
  }

  return GoogleProvider({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    allowDangerousEmailAccountLinking: true,
  });
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUserResult> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { ok: false };
  }

  return { ok: true, userId };
}
