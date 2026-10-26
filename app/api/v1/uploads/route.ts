import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import {
  requireTenant,
  unauthorized,
  badRequest,
  serverError,
  readJsonBody,
  firstZodError,
  NO_STORE,
} from "@vrm/lib/api/auth";
import { maxVideoSecondsFor, startApiUpload } from "@vrm/lib/api/uploads";

/**
 * A business adding a testimonial video it already has.
 *
 *   GET  /api/v1/uploads   {"max_video_seconds":180}
 *   POST /api/v1/uploads   {"reviewer_name":"Molly Leopold","rating":5,"consent":true,
 *                           "content_type":"video/mp4","duration_seconds":74}
 *
 * POST writes the review, HIDDEN and marked "uploaded", and returns a credential
 * for sending that one video straight to the host. Once the bytes are there,
 * PATCH /reviews/{id} {"status":"approved"} puts it live. The why of each step is
 * in vrm/lib/api/uploads.ts.
 *
 * NO CORS HEADERS, as with every /api/v1 route: these are secret-key endpoints.
 * The CREDENTIAL in the reply is browser-safe -- it can put bytes into one video
 * and nothing else -- so the caller may hand that on to its own browser.
 */

const UploadSchema = z.object({
  reviewer_name: z.string().trim().min(1, { error: "reviewer_name is required." }).max(120),
  reviewer_email: z.union([z.email(), z.literal(""), z.null()]).optional(),
  rating: z.number({ error: "rating must be a whole number from 1 to 5." }).int().min(1).max(5),
  // Only the literal true. The business is telling us they hold the customer's
  // permission; a missing or false value is a refusal, not a default.
  consent: z.literal(true, { error: "consent must be true: the business must hold the reviewer's permission." }),
  content_type: z
    .string()
    .trim()
    .regex(/^video\/[a-z0-9.+-]+$/i, { error: "content_type must be a video type, like video/mp4." }),
  duration_seconds: z.number().positive({ error: "duration_seconds must be the video's length in seconds." }),
});

export async function GET(request: NextRequest) {
  const tenant = await requireTenant(request);
  if (!tenant) return unauthorized();

  try {
    return NextResponse.json(
      { max_video_seconds: await maxVideoSecondsFor(tenant.id) },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("GET /api/v1/uploads failed:", err);
    return serverError("Could not load the upload limits.");
  }
}

export async function POST(request: NextRequest) {
  const tenant = await requireTenant(request);
  if (!tenant) return unauthorized();

  const { body, error } = await readJsonBody(request);
  if (error) return error;

  const parsed = UploadSchema.safeParse(body);
  if (!parsed.success) return badRequest(firstZodError(parsed.error));

  try {
    const result = await startApiUpload(tenant, {
      reviewerName: parsed.data.reviewer_name,
      reviewerEmail: parsed.data.reviewer_email || null,
      rating: parsed.data.rating,
      contentType: parsed.data.content_type,
      durationSeconds: parsed.data.duration_seconds,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
    }

    // The tenant's own dashboard lists reviews; this one is there now, hidden.
    revalidatePath("/video/dashboard");
    revalidatePath("/video/dashboard/reviews");
    revalidatePath(`/video/admin/tenants/${tenant.id}`);

    return NextResponse.json(
      { review: result.review, upload: result.upload, max_video_seconds: result.maxVideoSeconds },
      { status: 201, headers: NO_STORE },
    );
  } catch (err) {
    // prepareVideoUpload throws when Bunny or Storage refuses to reserve the video.
    console.error("POST /api/v1/uploads failed:", err);
    return serverError("Could not start the upload.");
  }
}
