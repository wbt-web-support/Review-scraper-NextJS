import type { NextApiRequest, NextApiResponse } from 'next';
import * as storage from '../../../../lib/storage'; 
import dbConnect from '../../../../lib/mongodb';   
import { Types } from 'mongoose';
import { IWidgetSettingsFromForm, IReviewItemFromAPI } from '../../../../components/WidgetPreview'; 

export interface PublicWidgetDataResponse {
  widgetSettings: IWidgetSettingsFromForm;
  reviews: IReviewItemFromAPI[];
  businessName?: string; 
  businessUrlLink?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PublicWidgetDataResponse | { message: string }>
) {
  const { widgetId } = req.query;
  const limitQuery = req.query.limit;

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  if (typeof widgetId !== 'string' || !Types.ObjectId.isValid(widgetId)) {
    return res.status(400).json({ message: 'Invalid widget ID format.' });
  }

  try {
    await dbConnect();

    const widgetDoc = await storage.getWidgetById(widgetId);

    if (!widgetDoc || (widgetDoc.isActive !== undefined && !widgetDoc.isActive)) {
      return res.status(404).json({ message: 'Widget not found or is not active.' });
    }

    let reviews: IReviewItemFromAPI[] = [];
    let fetchedBusinessName: string | undefined = widgetDoc.businessUrl?.name;
    let fetchedBusinessUrlLink: string | undefined = widgetDoc.businessUrl?.url;

    if (widgetDoc.businessUrlId && widgetDoc.businessUrlSource) {
      if (!fetchedBusinessName || !fetchedBusinessUrlLink) {
          const parentBusinessUrl = await storage.getBusinessUrlById(widgetDoc.businessUrlId.toString());
          if (parentBusinessUrl) {
              fetchedBusinessName = parentBusinessUrl.name;
              fetchedBusinessUrlLink = parentBusinessUrl.url;
          }
      }

      const businessUrlForReviewQuery = await storage.getBusinessUrlById(widgetDoc.businessUrlId.toString());
      if (businessUrlForReviewQuery && businessUrlForReviewQuery.urlHash) {
        const reviewBatch = await storage.getReviewBatchForBusinessUrl(
          businessUrlForReviewQuery.urlHash,
          widgetDoc.businessUrlSource as 'google' | 'facebook'
        );
        if (reviewBatch && reviewBatch.reviews) {
          reviews = storage.getFilteredReviewsFromBatch(reviewBatch, {
            minRating: widgetDoc.minRating,
            limit: parseInt(limitQuery as string) || widgetDoc.maxReviews || 10,
          });
        }
      }
    }

    const widgetSettingsForPublic: IWidgetSettingsFromForm = {
      name: widgetDoc.name,
      themeColor: widgetDoc.settings?.themeColor as string || widgetDoc.themeColor || '#3B82F6',
      layout: widgetDoc.type,
      minRating: widgetDoc.minRating,
      showRatings: (widgetDoc.settings?.showRatings as boolean) ?? widgetDoc.showRatings,
      showDates: (widgetDoc.settings?.showDates as boolean) ?? widgetDoc.showDates,
      showProfilePictures: (widgetDoc.settings?.showProfilePictures as boolean) ?? widgetDoc.showProfilePictures,
      businessUrl: {
          _id: widgetDoc.businessUrlId.toString(),
          name: fetchedBusinessName || "Unknown Business",
          source: widgetDoc.businessUrlSource as 'google' | 'facebook',
          url: fetchedBusinessUrlLink
      },
      maxReviews: widgetDoc.maxReviews,
    };

    res.status(200).json({
      widgetSettings: widgetSettingsForPublic,
      reviews,
      businessName: fetchedBusinessName,
      businessUrlLink: fetchedBusinessUrlLink,
    });

  } catch (error) {
    console.error(`API Error fetching public widget data for ID ${widgetId}:`, error);
    const message = error instanceof Error ? error.message : 'Server error fetching widget data.';
    res.status(500).json({ message });
  }
}