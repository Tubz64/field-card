import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { HttpError, parseJsonBody, toErrorResponse } from '../lib/http.js';
import type { RouteContext } from '../lib/types.js';
import { deleteAccount } from '../routes/account.js';
import { createPet, deletePet, getPet, listPets, updatePet } from '../routes/pets.js';
import { confirmPhoto, removePhoto, startPhotoUpload } from '../routes/photo.js';
import {
  createVaccination,
  deleteVaccination,
  updateVaccination,
} from '../routes/vaccinations.js';
import routeKeys from './routes.json';

type RouteHandler = (ctx: RouteContext) => Promise<APIGatewayProxyResultV2>;

// Keys must match routes.json, which Terraform uses to create the API
// Gateway routes (test/api.test.ts checks they stay in sync).
export const routes: Record<string, RouteHandler> = {
  'GET /pets': listPets,
  'POST /pets': createPet,
  'GET /pets/{petId}': getPet,
  'PATCH /pets/{petId}': updatePet,
  'DELETE /pets/{petId}': deletePet,
  'POST /pets/{petId}/vaccinations': createVaccination,
  'PATCH /pets/{petId}/vaccinations/{vaccinationId}': updateVaccination,
  'DELETE /pets/{petId}/vaccinations/{vaccinationId}': deleteVaccination,
  'POST /pets/{petId}/photo/upload': startPhotoUpload,
  'PUT /pets/{petId}/photo': confirmPhoto,
  'DELETE /pets/{petId}/photo': removePhoto,
  'DELETE /account': deleteAccount,
};

export { routeKeys };

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  try {
    // API Gateway's JWT authorizer has already verified the token; this is
    // defence in depth, and the source of the user's identity.
    const claims = event.requestContext.authorizer?.jwt?.claims ?? {};
    const userId = claims.sub;
    if (typeof userId !== 'string' || !userId) throw new HttpError(401, 'Unauthorized');
    // Access tokens carry `username`, ID tokens `cognito:username`.
    const username = String(claims.username ?? claims['cognito:username'] ?? userId);

    const route = routes[event.routeKey];
    if (!route) throw new HttpError(404, 'Not found');

    return await route({
      userId,
      username,
      params: event.pathParameters ?? {},
      body: parseJsonBody(event.body, event.isBase64Encoded),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
