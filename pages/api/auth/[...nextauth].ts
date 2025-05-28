import NextAuth, { type NextAuthOptions, Account, Profile, Session } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { comparePassword, getUserByEmail } from '../../../lib/storage';
import dbConnect from '../../../lib/mongodb';
import { JWT } from 'next-auth/jwt';

interface AuthorizeUserResponse { 
  id: string;
  email?: string | null;
  name?: string | null;
  username?: string | null;
  fullName?: string | null;
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
          const userFromDb = await getUserByEmail(credentials!.email!);
          if (!userFromDb || !userFromDb.password) return null;
          const isMatch = await comparePassword(credentials!.password!, userFromDb.password);
          if (!isMatch) {
            return null;
          }
          return {
              id: userFromDb._id.toString(),
              email: userFromDb.email,
              name: userFromDb.fullName || userFromDb.username,
              username: userFromDb.username,
              fullName: userFromDb.fullName,
          };
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