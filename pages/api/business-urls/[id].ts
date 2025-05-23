import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import * as storage from '../../../lib/storage';
import dbConnect from '../../../lib/mongodb';
import { Types } from'mongoose';
import { IBusinessUrl } from '@/models/BusinessUrl.model';

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
      return res.status(501).json({ message: 'Not Implemented: PUT method for updating business URL is not yet implemented.' });
    } else if (req.method === 'DELETE') {
      return res.status(501).json({ message: 'Not Implemented: DELETE method for deleting business URL is not yet implemented.' });
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