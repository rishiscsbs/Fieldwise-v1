// Image uploads on local disk. Type is checked from the file's bytes, not the client's claim.
// Files are served through short-lived signed URLs so <img> tags work without an auth header.
import { createHmac } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import type { Upload } from '@prisma/client';
import type { UploadDto } from '@fieldwise/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { badRequest } from '../lib/http.js';
import { sameHash, sha256 } from '../lib/crypto.js';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const URL_TTL_S = 3600;

export const UPLOAD_DIR = resolve(fileURLToPath(new URL('..', import.meta.url)), '..', env.UPLOAD_DIR);

const TYPES = [
  { mime: 'image/jpeg', ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
] as const;

export function sniff(buf: Buffer): (typeof TYPES)[number] | null {
  return TYPES.find((t) => t.magic.every((b, i) => buf[i] === b)) ?? null;
}

export async function saveUpload(ownerId: string, buf: Buffer): Promise<Upload> {
  if (buf.length === 0) throw badRequest('upload_empty', 'The file is empty');
  if (buf.length > MAX_UPLOAD_BYTES) throw badRequest('upload_too_large', 'Photos must be 5 MB or smaller');
  const type = sniff(buf);
  if (!type) throw badRequest('upload_type', 'Upload a JPEG or PNG photo');
  const digest = sha256(buf);
  const month = new Date().toISOString().slice(0, 7);
  const rel = `${month}/${digest.slice(0, 32)}.${type.ext}`;
  const abs = join(UPLOAD_DIR, rel);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, buf);
  return prisma.upload.create({
    data: { ownerId, path: rel, mime: type.mime, size: buf.length, sha256: digest },
  });
}

export const readUpload = (u: Pick<Upload, 'path'>) => readFile(join(UPLOAD_DIR, u.path));

const signature = (id: string, exp: number) =>
  createHmac('sha256', env.JWT_SECRET).update(`upload:${id}:${exp}`).digest('hex');

/** Signed URL valid for at least an hour. Expiry is rounded so the URL stays stable (and cacheable) within the hour. */
export function signedUrl(id: string, now = Date.now()): string {
  const exp = (Math.floor(now / 1000 / URL_TTL_S) + 2) * URL_TTL_S;
  return `/api/uploads/${id}?exp=${exp}&sig=${signature(id, exp)}`;
}

export function verifySignature(id: string, exp: number, sig: string, now = Date.now()): boolean {
  return exp * 1000 > now && sameHash(sig, signature(id, exp));
}

export const uploadDto = (u: Upload): UploadDto => ({
  id: u.id,
  url: signedUrl(u.id),
  mime: u.mime,
  size: u.size,
});

export interface Rgba {
  width: number;
  height: number;
  data: Uint8Array | Buffer;
}

/** Decodes a JPEG or PNG and scales it down (nearest neighbour) so the long side is at most `max` px. */
export function decodeImage(buf: Buffer, max = 260): Rgba {
  const type = sniff(buf);
  let img: Rgba;
  if (type?.mime === 'image/jpeg') {
    img = jpeg.decode(buf, {
      useTArray: true,
      formatAsRGBA: true,
      maxResolutionInMP: 40,
      maxMemoryUsageInMB: 256,
    });
  } else if (type?.mime === 'image/png') {
    img = PNG.sync.read(buf);
  } else {
    throw badRequest('upload_type', 'Upload a JPEG or PNG photo');
  }
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  if (scale === 1) return img;
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(img.height - 1, Math.floor(y / scale));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(img.width - 1, Math.floor(x / scale));
      const s = (sy * img.width + sx) * 4;
      const d = (y * width + x) * 4;
      data[d] = img.data[s]!;
      data[d + 1] = img.data[s + 1]!;
      data[d + 2] = img.data[s + 2]!;
      data[d + 3] = 255;
    }
  }
  return { width, height, data };
}
