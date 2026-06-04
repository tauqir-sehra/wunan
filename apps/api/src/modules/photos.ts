// Listing photos (FR-012; research §8). Every upload is decoded and re-encoded as WebP by sharp,
// which drops all metadata (including GPS location). Files are stored under a random name and are
// only ever served to signed-in members.
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { and, count, eq } from 'drizzle-orm';
import sharp from 'sharp';
import { config } from '../config.ts';
import { db } from '../db/index.ts';
import { listingPhoto } from '../db/schema/index.ts';
import { ApiError, errors } from '../lib/errors.ts';
import { ownedListing } from './listings.ts';

export const MAX_PHOTOS = 6;
export const MAX_BYTES = 10 * 1024 * 1024;
const LONGEST_EDGE = 1600;
const KEY_PATTERN = /^[a-f0-9]{32}$/;
const PHOTO_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'heif', 'avif', 'tiff']);

const photosDir = path.resolve(config.PHOTOS_DIR);
const fileFor = (key: string) => path.join(photosDir, `${key}.webp`);

export async function addPhoto(listingId: string, ownerId: string, file: File, alt: string | null) {
  await ownedListing(listingId, ownerId);
  if (file.size > MAX_BYTES) throw new ApiError(413, 'too_large', 'That photo is larger than 10 MB. Please choose a smaller one.');
  const [existing] = await db.select({ photos: count() }).from(listingPhoto).where(eq(listingPhoto.listingId, listingId));
  if ((existing?.photos ?? 0) >= MAX_PHOTOS) {
    throw new ApiError(409, 'too_many_photos', 'A listing can have up to 6 photos. Remove one to add another.');
  }

  const notAPhoto = () =>
    new ApiError(400, 'not_an_image', "That file isn't a photo we can use. Please choose a JPEG, PNG, or WebP image.");
  const input = Buffer.from(await file.arrayBuffer());
  // Decide by the file's real contents, not its name or stated type. Only photo formats:
  // SVG and other document-like formats are refused.
  const format = await sharp(input).metadata().then((m) => m.format, () => undefined);
  if (!format || !PHOTO_FORMATS.has(format)) throw notAPhoto();

  let webp: Buffer;
  try {
    // limitInputPixels guards against "decompression bombs" (tiny files that expand hugely).
    webp = await sharp(input, { limitInputPixels: 100_000_000 })
      .rotate() // Apply the camera's orientation before the metadata is dropped.
      .resize({ width: LONGEST_EDGE, height: LONGEST_EDGE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw notAPhoto();
  }

  const key = randomBytes(16).toString('hex');
  await mkdir(photosDir, { recursive: true });
  await writeFile(fileFor(key), webp);
  const [row] = await db
    .insert(listingPhoto)
    .values({ listingId, fileKey: key, altText: alt, position: existing?.photos ?? 0 })
    .returning();
  return photoResponse(row!);
}

export async function updatePhoto(listingId: string, ownerId: string, photoId: string, changes: { alt?: string | null | undefined; position?: number | undefined }) {
  await ownedListing(listingId, ownerId);
  const values: Partial<typeof listingPhoto.$inferInsert> = {};
  if (changes.alt !== undefined) values.altText = changes.alt;
  if (changes.position !== undefined) values.position = changes.position;
  const [row] = await db
    .update(listingPhoto)
    .set(values)
    .where(and(eq(listingPhoto.id, photoId), eq(listingPhoto.listingId, listingId)))
    .returning();
  if (!row) throw errors.notFound('That photo');
  return photoResponse(row);
}

export async function deletePhoto(listingId: string, ownerId: string, photoId: string) {
  await ownedListing(listingId, ownerId);
  const [row] = await db
    .delete(listingPhoto)
    .where(and(eq(listingPhoto.id, photoId), eq(listingPhoto.listingId, listingId)))
    .returning();
  if (!row) throw errors.notFound('That photo');
  await rm(fileFor(row.fileKey), { force: true });
}

/** Deletes the files of photos whose rows are being removed (e.g., account deletion). */
export async function deletePhotoFiles(keys: string[]) {
  await Promise.all(keys.map((key) => rm(fileFor(key), { force: true })));
}

/** Image bytes for a signed-in member. The key format is checked so it can't point elsewhere. */
export async function readPhoto(key: string): Promise<Buffer> {
  if (!KEY_PATTERN.test(key)) throw errors.notFound('That photo');
  const [row] = await db.select({ id: listingPhoto.id }).from(listingPhoto).where(eq(listingPhoto.fileKey, key));
  if (!row) throw errors.notFound('That photo');
  try {
    return await readFile(fileFor(key));
  } catch {
    throw errors.notFound('That photo');
  }
}

function photoResponse(row: typeof listingPhoto.$inferSelect) {
  return { id: row.id, key: row.fileKey, url: `/api/v1/photos/${row.fileKey}`, alt: row.altText, position: row.position };
}
