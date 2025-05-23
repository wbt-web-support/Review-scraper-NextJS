import 'next-auth';
import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

interface ExtendedUserProperties {
  id: string;
  username?: string | null;
  fullName?: string | null;
}

declare module "next-auth" {
  interface Session {
    user: ExtendedUserProperties & DefaultSession["user"];
  }
  interface User extends DefaultUser, ExtendedUserProperties {}
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT, ExtendedUserProperties {}
}