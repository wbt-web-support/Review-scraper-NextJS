import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import dbConnect from '../../../lib/mongodb';
import UserModel from '../../../models/User.model';
import { requireOperator } from '../../../lib/apiAuth';

/** PUT /api/auth/password -- the signed-in operator changes their password, proving the current one first. */
const schema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long.').max(200),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  const session = await requireOperator(req, res);
  if (!session) return;
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid password.' });

  await dbConnect();
  const user = await UserModel.findById(session.user.id).select('+password').exec();
  if (!user?.password) return res.status(404).json({ message: 'Account not found.' });
  if (!(await bcrypt.compare(parsed.data.currentPassword, user.password))) {
    return res.status(400).json({ message: 'Your current password is not right.' });
  }
  user.password = await bcrypt.hash(parsed.data.newPassword, await bcrypt.genSalt(10));
  await user.save();
  return res.status(200).json({ message: 'Your password has been changed.' });
}
