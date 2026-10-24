import type { NextApiRequest, NextApiResponse } from 'next';
import { ZodError } from 'zod';
import { registerSchema } from '../../../lib/schemas/user'; 
import * as storage from '../../../lib/storage'; 
import { handleZodError } from '../../../lib/utils'; 
import dbConnect from '../../../lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  // Accounts made here are operators, who see and manage every client. So only a
  // signed-in operator can add one (for a new teammate). It used to be open to
  // anyone on the internet. ALLOW_PUBLIC_SIGNUP=1 reopens it if that is ever wanted.
  if (process.env.ALLOW_PUBLIC_SIGNUP !== '1') {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id || session.user.role === 'client') {
      return res.status(403).json({ message: 'New accounts are created by an existing team member. Ask them to add you.' });
    }
  }
  try {
    await dbConnect();
    const userData = registerSchema.parse(req.body);
    const existingUserByUsername = await storage.getUserByUsername(userData.username);
    if (existingUserByUsername) {
      return res.status(400).json({ message: 'Username is already taken. Please choose another.' });
    }
    const existingUserByEmail = await storage.getUserByEmail(userData.email);
    if (existingUserByEmail) {
      return res.status(400).json({ message: 'This email address is already registered.' });
    }
    const newUser = await storage.createUser(userData);
    res.status(201).json(newUser);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json(handleZodError(error));
    }
    console.error("Registration API error:", error instanceof Error ? error.message : error, error);
    if (error instanceof Error && (error.message.includes("Username already exists") || error.message.includes("Email already exists"))) {
        return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'An error occurred during registration. Please try again.' });
  }
}