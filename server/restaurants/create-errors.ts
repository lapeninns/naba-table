/**
 * Typed failures from `createRestaurant` (server/restaurants/create.ts). Kept in their own
 * module so route tests that mock `@/server/restaurants/create` still get real classes.
 */

/** The creating user already belongs to a restaurant (the RPC's membership invariant). */
export class RestaurantAccessExistsError extends Error {
  constructor() {
    super('User already has restaurant access');
    this.name = 'RestaurantAccessExistsError';
  }
}

/** Every generated slug candidate collided with an existing restaurant. */
export class RestaurantSlugUnavailableError extends Error {
  constructor() {
    super('Unable to generate unique slug after multiple attempts');
    this.name = 'RestaurantSlugUnavailableError';
  }
}

/** An input rule failed; `message` is safe to show to the caller. */
export class RestaurantCreateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RestaurantCreateValidationError';
  }
}
