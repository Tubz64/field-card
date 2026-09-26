import type { SPECIES } from './validation.js';

export type Species = (typeof SPECIES)[number];

export interface RouteContext {
  /** Cognito `sub` of the signed-in user; every query is scoped to it. */
  userId: string;
  params: Record<string, string | undefined>;
  body: unknown;
}
