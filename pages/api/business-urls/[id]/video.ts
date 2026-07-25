import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import * as storage from '../../../../lib/storage';
import dbConnect from '../../../../lib/mongodb';
import { Types } from 'mongoose';
import {
  videoTenantSchema,
  provisionVideoTenant,
  originForRequest,
} from '@/lib/videoTenant';

/**
 * Enable video reviews for a business that already exists.
 *
 * Every scraped business can be given a Video Review Manager tenant after the fact --
 * this is that action. It provisions the tenant (collection page, embed key, the
 * client's login) and links it to the business. Idempotency is deliberate: a business
 * already wired up is refused rather than provisioned twice, so a double click cannot
 * mint a second tenant and orphan the first.
 *
 * Authorization is the NextAuth session AND ownership of the business. Provisioning
 * itself has no auth of its own (see lib/videoTenant.ts), so this route is the guard.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    await dbConnect();
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user?.id) {
      return res.status(401).json({ message: 'Unauthorized: Not authenticated.' });
    }
    const userId = session.user.id as string;

    const { id } = req.query;
    if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid business id.' });
    }

    const business = await storage.getBusinessUrlById(id);
    if (!business) {
      return res.status(404).json({ message: 'Business not found.' });
    }
    if (!business.userId || business.userId.toString() !== userId) {
      return res.status(403).json({ message: 'Forbidden: this is not your business.' });
    }
    if (business.video?.tenantId) {
      return res.status(409).json({
        message: 'Video reviews are already set up for this business.',
      });
    }

    const parsed = videoTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return res.status(400).json({ message: first?.message ?? 'Invalid details.' });
    }

    const provisioned = await provisionVideoTenant(
      { name: business.name, ...parsed.data },
      originForRequest(req),
    );
    if (!provisioned.ok) {
      return res.status(400).json({ message: provisioned.message });
    }

    await storage.setBusinessUrlVideo(id, provisioned.link);
    // Seed the editable details from what was just entered, unless the business already
    // has some (an earlier edit shouldn't be clobbered).
    if (!business.details) {
      await storage.updateBusinessUrlDetails(id, {
        details: {
          email: parsed.data.contactEmail,
          phone: parsed.data.contactPhone || '',
          brandColor: parsed.data.brandColor,
          logoUrl: parsed.data.logoUrl || '',
        },
      });
    }
    return res.status(200).json({ video: provisioned.link });
  } catch (error: unknown) {
    console.error(`API Error in /api/business-urls/${req.query.id}/video:`, error);
    const message = error instanceof Error ? error.message : 'An unexpected server error occurred.';
    return res.status(500).json({ message });
  }
}
