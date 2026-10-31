import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { restaurants } from "@/db/schema";
import { createListing } from "@/services/listings";

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

// Restaurant posts surplus: multipart form with restaurantId, notes and an optional photo.
export async function POST(request: Request) {
  const form = await request.formData();
  const restaurantId = String(form.get("restaurantId") ?? "");
  const notes = String(form.get("notes") ?? "").slice(0, 1000);
  const photo = form.get("photo");

  const db = getDb();
  const [restaurant] = await db.select({ id: restaurants.id }).from(restaurants).where(eq(restaurants.id, restaurantId));
  if (!restaurant) return Response.json({ error: "Unknown restaurant" }, { status: 404 });

  let photoInput: { data: Uint8Array; mediaType: string } | undefined;
  let photoUrl: string | undefined;
  if (photo instanceof File && photo.size > 0) {
    if (!photo.type.startsWith("image/")) return Response.json({ error: "Photo must be an image" }, { status: 400 });
    if (photo.size > MAX_PHOTO_BYTES) return Response.json({ error: "Photo is over 4 MB" }, { status: 413 });
    const data = new Uint8Array(await photo.arrayBuffer());
    photoInput = { data, mediaType: photo.type };
    // Stored inline for the prototype; Render's disk is wiped on every deploy.
    photoUrl = `data:${photo.type};base64,${Buffer.from(data).toString("base64")}`;
  }
  if (!photoInput && !notes.trim()) {
    return Response.json({ error: "Add a photo or a short note" }, { status: 400 });
  }

  try {
    const result = await createListing(db, { restaurantId, notes, photo: photoInput, photoUrl });
    return Response.json(result, { status: 201 });
  } catch (err) {
    console.error("Intake failed", err);
    return Response.json({ error: "Couldn't read that listing. Try again or type a note." }, { status: 502 });
  }
}
