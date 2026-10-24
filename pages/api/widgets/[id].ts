import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import dbConnect from '@/lib/mongodb';
import * as storage from '@/lib/storage';
import { purgeTenant } from '@vrm/lib/tenants/purge';

interface ErrorResponse {
  message: string;
}


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any | ErrorResponse>
) {
  // CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,DELETE,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'DELETE' && req.method !== 'PUT') {
    res.setHeader('Allow', ['DELETE', 'PUT']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    // Connect to database
    await dbConnect();

    // Verify user authentication
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get widget ID from query
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'Widget ID is required.' });
    }

    // The widget, and whether this person may touch it. Widgets belong to the
    // operator who made them (the widgets page lists only your own); client logins
    // never manage widgets.
    if (session.user.role === 'client') {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    const widget = await storage.getWidgetForPublicFeed(id);
    if (!widget) {
      return res.status(404).json({ message: 'Widget not found.' });
    }
    if (String(widget.userId) !== String(session.user.id)) {
      return res.status(403).json({ message: 'This widget belongs to another account.' });
    }

    if (req.method === 'DELETE') {
      // A video widget owns a whole Supabase tenant: the client's login, their
      // reviews, and their recorded videos on Bunny. Tear that down FIRST -- if the
      // Mongo row went first and this failed, the widget would be gone from the list
      // and the tenant would be left running with nothing pointing at it.
      if (widget.type === 'video' && widget.video?.tenantId) {
        const purged = await purgeTenant(widget.video.tenantId);
        if (!purged.ok) {
          return res.status(500).json({
            message: `Could not delete the video tenant: ${purged.error}`,
          });
        }
      }

      const result = await storage.deleteWidget(id);
      if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Widget not found or already deleted.' });
      }
      return res.status(200).json(result);
    }

    if (req.method === 'PUT') {
      const parsed = await sanitizeWidgetUpdate(req.body, widget.type === 'video');
      if ('error' in parsed) {
        return res.status(400).json({ message: parsed.error });
      }
      const updatedWidget = await storage.updateWidget(id, parsed.update);
      if (!updatedWidget) {
        return res.status(404).json({ message: 'Widget not found.' });
      }
      return res.status(200).json(updatedWidget);
    }

  } catch (error: unknown) {
    console.error('API Error in /api/widgets/[id]:', error);
    const message = error instanceof Error ? error.message : 'Server error processing widget request.';
    return res.status(500).json({ message });
  }
}

const LAYOUTS = ['grid', 'carousel', 'list', 'masonry', 'badge', 'bar', 'wall'] as const;

/**
 * Only the fields the widget editor actually sets, each checked. The old handler
 * passed the whole request body into the update, so an edit could also rewrite
 * the widget's owner or its video tenant.
 *
 * A changed business also moves the widget's urlHash and source with it: the live
 * widget reads its reviews by urlHash, so changing only the id did nothing.
 */
export async function sanitizeWidgetUpdate(body: unknown, isVideo: boolean): Promise<{ update: Parameters<typeof storage.updateWidget>[1] } | { error: string }> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const update: Parameters<typeof storage.updateWidget>[1] = {};

  if (typeof b.name !== 'string' || !b.name.trim()) return { error: 'Name is required.' };
  update.name = b.name.trim().slice(0, 120);

  if (b.themeColor !== undefined) {
    if (typeof b.themeColor !== 'string' || !/^#[0-9a-f]{3,8}$/i.test(b.themeColor)) return { error: 'Theme colour must be a hex value like #3B82F6.' };
    update.themeColor = b.themeColor;
  }
  if (!isVideo) {
    const layout = b.type ?? b.layout;
    if (layout !== undefined) {
      if (!LAYOUTS.includes(layout as (typeof LAYOUTS)[number])) return { error: 'Unknown layout.' };
      update.type = layout as (typeof LAYOUTS)[number];
    }
    for (const key of ['minRating', 'maxReviews', 'initialReviewCount'] as const) {
      if (b[key] === undefined) continue;
      const n = Number(b[key]);
      const [min, max] = key === 'minRating' ? [0, 5] : [1, 1000];
      if (!Number.isFinite(n) || n < min || n > max) return { error: `${key} is out of range.` };
      update[key] = key === 'minRating' ? n : Math.round(n);
    }
    for (const key of ['showRatings', 'showDates', 'showProfilePictures'] as const) {
      if (b[key] === undefined) continue;
      if (typeof b[key] !== 'boolean') return { error: `${key} must be true or false.` };
      update[key] = b[key] as boolean;
    }
    if (b.settings !== undefined) {
      if (!b.settings || typeof b.settings !== 'object' || Array.isArray(b.settings) || JSON.stringify(b.settings).length > 10_000) return { error: 'Invalid widget settings.' };
      update.settings = b.settings as Record<string, unknown>;
    }
    if (b.businessUrlId !== undefined) {
      if (typeof b.businessUrlId !== 'string') return { error: 'Invalid business.' };
      const business = await storage.getBusinessUrlById(b.businessUrlId);
      if (!business) return { error: 'That business no longer exists.' };
      update.businessUrlId = b.businessUrlId;
      update.businessUrlSource = business.source === 'facebook' ? 'FacebookBusinessUrl' : 'GoogleBusinessUrl';
      update.urlHash = business.urlHash;
    }
  }
  if (b.isActive !== undefined) {
    if (typeof b.isActive !== 'boolean') return { error: 'isActive must be true or false.' };
    update.isActive = b.isActive;
  }
  return { update };
}
