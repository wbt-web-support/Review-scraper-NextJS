import NextAuth, { type NextAuthOptions, Account, Profile, Session } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { comparePassword, getUserByEmail } from '../../../lib/storage';
import { findVideoBusinessLogin } from '../../../lib/videoBusinessStore';
import dbConnect from '../../../lib/mongodb';
import { JWT } from 'next-auth/jwt';

interface AuthorizeUserResponse {
  id: string;
  email?: string | null;
  name?: string | null;
  username?: string | null;
  fullName?: string | null;
  role?: "operator" | "client";
  videoBusinessId?: string | null;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email", placeholder: "john@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials): Promise<AuthorizeUserResponse | null> {
        await dbConnect();
        if (!credentials?.email || !credentials.password) {
          return null;
        }
        console.log("[NextAuth Authorize] Received credentials:", { email: credentials.email })
        try {
          // 1) Agency operator (Mongo users, hashed password).
          const userFromDb = await getUserByEmail(credentials!.email!);
          if (userFromDb?.password) {
            const isMatch = await comparePassword(credentials!.password!, userFromDb.password);
            if (isMatch) {
              return {
                id: userFromDb._id.toString(),
                email: userFromDb.email,
                name: userFromDb.fullName || userFromDb.username,
                username: userFromDb.username,
                fullName: userFromDb.fullName,
                role: "operator",
              };
            }
          }

          // 2) Video-business client. Their login lives on the VideoBusiness record
          // (email + the password the operator set), so the same /login page signs
          // them in and scopes them to their own business.
          const client = await findVideoBusinessLogin(credentials!.email!, credentials!.password!);
          if (client) {
            return {
              id: client._id,
              email: client.email,
              name: client.name,
              fullName: client.name,
              role: "client",
              videoBusinessId: client._id,
            };
          }

          return null;
        } catch (dbError) {
          console.error("[NextAuth Authorize] Database error during authorization:", dbError);
          return null;
        }
    }
    })
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, account: _account, profile: _profile } : { token: JWT; user?: AuthorizeUserResponse; account?: Account | null; profile?: Profile }): Promise<JWT> {
      if (_account && user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.username = user.username;
        token.fullName = user.fullName;
        token.role = user.role ?? "operator";
        token.videoBusinessId = user.videoBusinessId ?? null;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }): Promise<Session> {
      if (token.id && session.user) {
        session.user.id = token.id;
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.username = token.username;
        session.user.fullName = token.fullName;
        session.user.role = token.role ?? "operator";
        session.user.videoBusinessId = token.videoBusinessId ?? null;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
