/**
 * Shrinks a photo before upload so it travels fast on a 2G/3G connection: long side 1024 px, JPEG 0.85.
 * Falls back to the original file if the browser cannot decode it.
 */
export async function shrinkPhoto(file: File, max = 1024): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.85),
    );
  } catch {
    return file;
  }
}
