import type { NextApiRequest, NextApiResponse } from 'next';
import * as storage from '../../../lib/storage';
import dbConnect from '../../../lib/mongodb';
import WidgetModel from '../../../models/Widget.model';

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

    console.log('Starting widget migration to add urlHash...');

    // Get all widgets that don't have urlHash
    const widgets = await WidgetModel.find({ urlHash: { $exists: false } }).lean().exec();
    console.log(`Found ${widgets.length} widgets without urlHash`);

    let updated = 0;
    let failed = 0;

    for (const widget of widgets) {
      try {
        console.log(`Processing widget ${widget._id}: ${widget.name}`);
        
        // Get the business URL to fetch urlHash
        const businessUrl = await storage.getBusinessUrlById(widget.businessUrlId.toString());
        
        if (businessUrl && businessUrl.urlHash) {
          // Update the widget with urlHash
          await WidgetModel.updateOne(
            { _id: widget._id },
            { $set: { urlHash: businessUrl.urlHash } }
          );
          
          console.log(`✅ Updated widget ${widget._id} with urlHash: ${businessUrl.urlHash}`);
          updated++;
        } else {
          console.log(`❌ Could not find business URL or urlHash for widget ${widget._id}`);
          failed++;
        }
      } catch (error) {
        console.error(`❌ Error processing widget ${widget._id}:`, error);
        failed++;
      }
    }

    console.log(`Migration complete: ${updated} updated, ${failed} failed`);

    res.status(200).json({
      message: 'Widget migration completed',
      total: widgets.length,
      updated,
      failed
    });

  } catch (error) {
    console.error('Migration error:', error);
    const message = error instanceof Error ? error.message : 'Server error during migration.';
    res.status(500).json({ message });
  }
} 