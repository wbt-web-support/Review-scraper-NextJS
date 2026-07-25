import 'next-auth';
import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

interface ExtendedUserProperties {
  id: string;
  username?: string | null;
  fullName?: string | null;
  /** "operator" = agency staff (Mongo users); "client" = a video business owner. */
  role?: "operator" | "client";
  /** For clients only: the VideoBusiness they own, scoping them to their own reviews. */
  videoBusinessId?: string | null;
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