import { PNG } from 'pngjs';
import type { App } from '../src/app.js';
import { prisma } from '../src/db.js';
import { requestOtp } from '../src/services/auth.js';

export interface Session {
  token: string;
  user: { id: string; role: string; districtId: string | null; name: string };
  auth: { authorization: string };
}

/** Signs in through the real OTP flow (the code comes from the service, as the API hides it outside dev). */
export async function login(app: App, phone: string): Promise<Session> {
  await prisma.otpCode.deleteMany({ where: { phone } });
  const { code } = await requestOtp(phone);
  const res = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code } });
  if (res.statusCode !== 200) throw new Error(`login ${phone}: ${res.statusCode} ${res.body}`);
  const body = res.json();
  return { token: body.accessToken, user: body.user, auth: { authorization: `Bearer ${body.accessToken}` } };
}

/** A PNG where `paint(x, y)` gives each pixel's RGB. */
export function png(
  width: number,
  height: number,
  paint: (x: number, y: number) => [number, number, number],
): Buffer {
  const img = new PNG({ width, height });
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const [r, g, b] = paint(x, y);
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  return PNG.sync.write(img);
}

/** A multipart/form-data body with one `file` part, merged with any extra headers (e.g. auth). */
export function multipart(
  buf: Buffer,
  headers: Record<string, string> = {},
  filename = 'leaf.png',
  type = 'image/png',
) {
  const boundary = '----fieldwise' + Math.random().toString(16).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, buf, tail]),
    headers: { ...headers, 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}
