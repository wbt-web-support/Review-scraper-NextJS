import  { handleZodError }  from '../../../lib/utils';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import * as storage from '../../../lib/storage';
import { businessUrlSchema } from '../../../lib/schemas/businessUrl';
import { ZodError } from 'zod';
import dbConnect from '../../../lib/mongodb';
import { IBusinessUrlDisplay } from '@/lib/storage';
import {
  videoTenantSchema,
  provisionVideoTenant,
  originForRequest,
} from '@/lib/videoTenant';
import { purgeTenant } from '@vrm/lib/tenants/purge';

interface BusinessUrlsApiResponse {
  businessUrls: IBusinessUrlDisplay[];
}

interface FormattedZodError {
  path: string;
  message: string;
}
interface ErrorResponse {
  message: string;
  errors?: FormattedZodError[]; 
}
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BusinessUrlsApiResponse | IBusinessUrlDisplay | ErrorResponse>
) {
   const { method } = req;
  console.log(`[API /api/business-urls] Received request: Method ${method}`);

  try {
    await dbConnect();
    console.log("[API /api/business-urls] DB Connected.");
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user?.id) {
      console.log("[API /api/business-urls] Unauthorized: No session or user ID.");
      return res.status(401).json({ message: 'Unauthorized: Not authenticated.' });
    }
    const userId_string = session.user.id as string;
    console.log(`[API /api/business-urls] Authenticated User ID: ${userId_string}`);
    if (req.method === 'GET') {
      console.log(`[API /api/business-urls GET] Calling storage.getBusinessUrlsByUserId for user: ${userId_string}`);
      const businessUrls = await storage.getBusinessUrlsByUserId(userId_string);
      return res.status(200).json({ businessUrls: businessUrls || [] });
    } else if (method === 'POST') {
      const businessUrlData = businessUrlSchema.parse(req.body);

      // Video reviews are opt-in per business. The dialog sends the tenant fields only
      // when the operator filled them, keyed by the presence of a contact email -- so a
      // plain scraping-only add still works exactly as before.
      const wantsVideo = typeof req.body?.contactEmail === 'string' && req.body.contactEmail.trim() !== '';

      // Create the business row FIRST: it throws on a duplicate URL, which is the
      // common failure, and doing it before provisioning means a dup never leaves a
      // live tenant behind to clean up.
      const newBusinessUrl = await storage.createBusinessUrl({
        ...businessUrlData,
        userId: userId_string,
      });

      if (wantsVideo) {
        const parsedVideo = videoTenantSchema.safeParse(req.body);
        if (!parsedVideo.success) {
          // Undo the business we just created, so a bad video form does not leave a
          // half-set-up business behind.
          await storage.deleteBusinessUrl(newBusinessUrl._id).catch(() => {});
          // videoTenantSchema is a zod v4 schema, so its error shape does not match
          // handleZodError (v3). Surface the first issue directly.
          const first = parsedVideo.error.issues[0];
          return res.status(400).json({ message: first?.message ?? 'Invalid video review details.' });
        }

        const provisioned = await provisionVideoTenant(
          { name: businessUrlData.name, ...parsedVideo.data },
          originForRequest(req),
        );
        if (!provisioned.ok) {
          await storage.deleteBusinessUrl(newBusinessUrl._id).catch(() => {});
          return res.status(400).json({ message: provisioned.message });
        }

        const details = {
          email: parsedVideo.data.contactEmail,
          phone: parsedVideo.data.contactPhone || '',
          brandColor: parsedVideo.data.brandColor,
          logoUrl: parsedVideo.data.logoUrl || '',
        };

        try {
          await storage.setBusinessUrlVideo(newBusinessUrl._id, provisioned.link);
          // Seed the editable details from what was just entered, so the Edit form
          // opens pre-filled rather than blank.
          await storage.updateBusinessUrlDetails(newBusinessUrl._id, { details });
        } catch (linkErr) {
          // The tenant is live but nothing in Mongo points at it. Unwind both, so we
          // never leave an orphan tenant the operator cannot see or manage from here.
          await purgeTenant(provisioned.tenantId).catch(() => {});
          await storage.deleteBusinessUrl(newBusinessUrl._id).catch(() => {});
          throw linkErr;
        }

        newBusinessUrl.video = provisioned.link;
        newBusinessUrl.details = details;
      }

      console.log("[API /api/business-urls POST] Created new business URL:", newBusinessUrl._id);
      return res.status(201).json(newBusinessUrl);
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ message: `Method ${method} Not Allowed` });
    }
  } catch (error: unknown) {
    console.error(`API Critical Error in /api/business-urls for method ${method}:`, error);
    const message = error instanceof Error ? error.message : 'An internal server error occurred.';
    let statusCode = 500;
    if (error instanceof ZodError) {
      statusCode = 400;
      return res.status(statusCode).json(handleZodError(error));
    }
    if (error instanceof Error && error.message.toLowerCase().includes("already been added")) {
      statusCode = 409; 
    }
    return res.status(statusCode).json({ message: statusCode === 500 ? 'An internal server error occurred.' : message });
  }
}