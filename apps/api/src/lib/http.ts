/** An error with an HTTP status and a stable code the client can switch on. The message is shown to users. */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what = 'That item') => new HttpError(404, 'not_found', `${what} was not found`);
export const forbidden = (message = 'You do not have access to this') =>
  new HttpError(403, 'forbidden', message);
export const badRequest = (code: string, message: string) => new HttpError(400, code, message);
