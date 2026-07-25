import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import * as storage from '../../../lib/storage';
import dbConnect from '../../../lib/mongodb';
import { Types } from'mongoose';
import { IBusinessUrl } from '@/models/BusinessUrl.model';
import { purgeTenant } from '@vrm/lib/tenants/purge';
import { updateTenantDetails } from '@/lib/videoTenant';
import { z } from 'zod';

/**
 * Editable business details. All optional -- an edit sends only what changed. Mirrors
 * the fields the Edit Business dialog shows.
 */
const editBusinessSchema = z.object({
  name: z.string().trim().min(2, 'Business name must be at least 2 characters.').max(120).optional(),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  email: z.union([z.string().trim().email('Enter a valid email.'), z.literal('')]).optional(),
  phone: z.string().trim().max(40).optional(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Brand colour must be a hex value like #8A9A5B.').optional(),
  logoUrl: z.union([z.string().url('Enter a valid URL.'), z.literal('')]).optional(),
});

interface DetailErrorItem {
  path?: string | readonly (string | number)[]; 
  message: string;
}

interface ErrorResponse {
  message: string;
  details?: DetailErrorItem[] | Record<string, unknown> | string;
}
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IBusinessUrl | Omit<ErrorResponse, 'details'> | ErrorResponse | { message: string }>
) {
  try {
    await dbConnect(); 
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user?.id) {
      return res.status(401).json({ message: 'Unauthorized: Not authenticated.' });
    }
    const userId_string = session.user.id as string;
    const { id: businessUrlId_param } = req.query;
    if (typeof businessUrlId_param !== 'string' || !businessUrlId_param) {
      return res.status(400).json({ message: 'Bad Request: Business URL ID parameter is missing or not a string.' });
    }
    if (!Types.ObjectId.isValid(businessUrlId_param)) {
      return res.status(400).json({ message: 'Bad Request: Invalid Business URL ID format.' });
    }
    if (req.method === 'GET') {
      const businessUrl = await storage.getBusinessUrlById(businessUrlId_param);
      if (!businessUrl) {
        return res.status(404).json({ message: 'Not Found: Business URL not found.' });
      }
      if (!businessUrl.userId || businessUrl.userId.toString() !== userId_string) {
        return res.status(403).json({ message: 'Forbidden: You do not have permission to view this resource.' });
      }
      return res.status(200).json(businessUrl);
    } else if (req.method === 'PUT') {
      const business = await storage.getBusinessUrlById(businessUrlId_param);
      if (!business) {
        return res.status(404).json({ message: 'Not Found: Business URL not found.' });
      }
      if (!business.userId || business.userId.toString() !== userId_string) {
        return res.status(403).json({ message: 'Forbidden: this is not your business.' });
      }

      const parsed = editBusinessSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid details.' });
      }
      const d = parsed.data;

      // Write the edit to Mongo (the source of truth the operator sees).
      await storage.updateBusinessUrlDetails(businessUrlId_param, {
        name: d.name,
        details: {
          firstName: d.firstName,
          lastName: d.lastName,
          email: d.email,
          phone: d.phone,
          brandColor: d.brandColor,
          logoUrl: d.logoUrl,
        },
      });

      // If video reviews are on, mirror the display fields onto the tenant so the
      // collection page and widget reflect the edit. Best-effort: the Mongo write
      // above already succeeded, and a tenant-sync hiccup should not fail the edit.
      if (business.video?.tenantId) {
        const synced = await updateTenantDetails(business.video.tenantId, {
          name: d.name,
          brandColor: d.brandColor,
          logoUrl: d.logoUrl,
          contactEmail: d.email,
          contactPhone: d.phone,
        });
        if (!synced.ok) {
          console.error(`[business-urls PUT] tenant sync failed for ${business.video.tenantId}: ${synced.error}`);
        }
      }

      return res.status(200).json({ message: 'Business updated.' });
    } else if (req.method === 'DELETE') {
      const businessUrl = await storage.getBusinessUrlById(businessUrlId_param);
      if (!businessUrl) {
        return res.status(404).json({ message: 'Not Found: Business URL not found.' });
      }
      if (!businessUrl.userId || businessUrl.userId.toString() !== userId_string) {
        return res.status(403).json({ message: 'Forbidden: You do not have permission to delete this business.' });
      }
      // If video reviews were enabled, the business owns a whole Supabase tenant: the
      // client's login, their recorded videos on Bunny, their reviews. Tear that down
      // FIRST -- if the Mongo row went first and this failed, the business would be
      // gone from the list and the tenant would be left running with nothing pointing
      // at it (and its videos billing and holding customers' faces, a GDPR problem).
      if (businessUrl.video?.tenantId) {
        const purged = await purgeTenant(businessUrl.video.tenantId);
        if (!purged.ok) {
          return res.status(500).json({ message: `Could not delete the video tenant: ${purged.error}` });
        }
      }
      await storage.deleteBusinessUrl(businessUrlId_param);
      return res.status(200).json({ message: 'Business URL deleted successfully.' });
    } else {
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']); 
      return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
  } catch (error: unknown) {
    console.error(`API Error in /api/business-urls/${req.query.id} for method ${req.method}:`, error);
    const message = error instanceof Error ? error.message : 'An unexpected server error occurred.';
    return res.status(500).json({ message });
  }
}