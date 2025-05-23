import  { handleZodError }  from '../../../lib/utils';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]'; 
import * as storage from '../../../lib/storage';
import { businessUrlSchema } from '../../../lib/schemas/businessUrl'; 
import { ZodError } from 'zod';
import dbConnect from '../../../lib/mongodb';
import { IBusinessUrlDisplay } from '@/lib/storage';

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
      const newBusinessUrl = await storage.createBusinessUrl({
        ...businessUrlData, 
        userId: userId_string,
      });
      console.log("[API /api/business-urls POST] Created new business URL:", newBusinessUrl);
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