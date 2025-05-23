import type { NextApiRequest, NextApiResponse } from 'next';
import { ZodError } from 'zod';
import { registerSchema } from '../../../lib/schemas/user'; 
import * as storage from '../../../lib/storage'; 
import { handleZodError } from '../../../lib/utils'; 
import dbConnect from '../../../lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
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