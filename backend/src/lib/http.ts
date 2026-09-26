import type { APIGatewayProxyResultV2 } from 'aws-lambda';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`);

export function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const noContent = (): APIGatewayProxyResultV2 => ({ statusCode: 204 });

export function parseJsonBody(body: string | undefined, isBase64Encoded: boolean): unknown {
  if (!body) return undefined;
  const text = isBase64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body;
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Request body is not valid JSON');
  }
}

export function toErrorResponse(err: unknown): APIGatewayProxyResultV2 {
  if (err instanceof HttpError) {
    return json(err.statusCode, { message: err.message, details: err.details });
  }
  if (err instanceof ZodError) {
    return json(400, {
      message: 'Invalid request',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  console.error('Unhandled error', err);
  return json(500, { message: 'Internal server error' });
}
