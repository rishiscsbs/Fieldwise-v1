import { z } from 'zod';

/** Error body for every non-2xx response. */
export const Err = z.object({ error: z.string(), message: z.string() });

export const errors = { 400: Err, 401: Err, 403: Err, 404: Err } as const;

/** OpenAPI marker for routes that need a bearer token. */
export const bearer = [{ bearer: [] }];

export const IdParams = z.object({ id: z.string().min(1) });
