import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import dbConnect from '../../../lib/mongodb';
import UserModel from '../../../models/User.model';
import { requireOperator } from '../../../lib/apiAuth';

/** PUT /api/auth/profile -- the signed-in operator updates their own name, email and username. */
const schema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters long.').max(120),
  email: z.string().trim().toLowerCase().email('Please enter a valid email address.'),
  username: z.string().trim().min(3, 'Username must be at least 3 characters long.').max(60),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  const session = await requireOperator(req, res);
  if (!session) return;
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid details.' });
  const { fullName, email, username } = parsed.data;

  await dbConnect();
  const me = session.user.id;
  // Email is the login, and usernames are unique: neither may collide with another account.
  const clash = await UserModel.findOne({ _id: { $ne: me }, $or: [{ email }, { username }] }, { email: 1, username: 1 }).lean();
  if (clash) {
    return res.status(409).json({ message: clash.email === email ? 'Another account already uses that email.' : 'That username is taken.' });
  }
  const user = await UserModel.findByIdAndUpdate(me, { $set: { fullName, email, username } }, { new: true }).lean();
  if (!user) return res.status(404).json({ message: 'Account not found.' });
  return res.status(200).json({
    message: 'Your profile has been updated.',
    user: { _id: String(user._id), fullName: user.fullName, email: user.email, username: user.username },
  });
}
