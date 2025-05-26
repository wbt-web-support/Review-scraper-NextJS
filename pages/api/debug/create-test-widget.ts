import type { NextApiRequest, NextApiResponse } from 'next';
import * as storage from '../../../lib/storage';
import dbConnect from '../../../lib/mongodb';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    await dbConnect();

    // Get all business URLs to find one with reviews
    const businessUrls = await storage.getAllBusinessUrlsForDisplay();
    console.log('Available business URLs:', businessUrls.map(b => ({ id: b._id, name: b.name, source: b.source })));

    // Find Heatseal Solar which should have reviews
    const heatsealBusiness = businessUrls.find(b => b.name.includes('Heatseal'));
    
    if (!heatsealBusiness) {
      return res.status(404).json({ message: 'Heatseal Solar business not found' });
    }

    console.log('Using business:', heatsealBusiness);

    // Create a test widget with proper settings
    const widgetData = {
      userId: "678200664a3e0c04261128c5", // Use a valid user ID
      name: `Test Widget - ${heatsealBusiness.name}`,
      businessUrlId: heatsealBusiness._id,
      businessUrlSource: heatsealBusiness.source, // Use the actual source value ('google' or 'facebook')
      type: 'grid',
      themeColor: '#3182CE',
      minRating: 0, // Show all reviews
      showRatings: true,
      showDates: true,
      showProfilePictures: true,
    };

    console.log('Creating widget with data:', widgetData);

    const createdWidget = await storage.createWidget(widgetData);
    
    console.log('Widget created:', createdWidget);

    // Test the widget data endpoint
    const testUrl = `/api/public/widget-data/${createdWidget._id}`;
    
    res.status(201).json({
      message: 'Test widget created successfully',
      widget: createdWidget,
      testUrl: `http://localhost:3000${testUrl}`,
      embedCode: `<script src="http://localhost:3000/widget.js" data-widget-id="${createdWidget._id}"></script>`
    });

  } catch (error) {
    console.error('Error creating test widget:', error);
    const message = error instanceof Error ? error.message : 'Server error creating test widget.';
    res.status(500).json({ message });
  }
} 