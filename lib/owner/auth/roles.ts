export const RESTAURANT_ROLE_OWNER = "owner" as const;
export const RESTAURANT_ROLE_MANAGER = "manager" as const;
export const RESTAURANT_ROLE_HOST = "host" as const;
export const RESTAURANT_ROLE_SERVER = "server" as const;

export const RESTAURANT_ROLES = [
  RESTAURANT_ROLE_OWNER,
  RESTAURANT_ROLE_MANAGER,
  RESTAURANT_ROLE_HOST,
  RESTAURANT_ROLE_SERVER,
] as const;

export type RestaurantRole = (typeof RESTAURANT_ROLES)[number];

export const RESTAURANT_ROLE_OPTIONS = RESTAURANT_ROLES.slice() as [RestaurantRole, ...RestaurantRole[]];

export const RESTAURANT_ADMIN_ROLES = [
  RESTAURANT_ROLE_OWNER,
  RESTAURANT_ROLE_MANAGER,
] as const;

export type RestaurantAdminRole = (typeof RESTAURANT_ADMIN_ROLES)[number];

export function isRestaurantRole(value: string | null | undefined): value is RestaurantRole {
  return typeof value === "string" && RESTAURANT_ROLES.includes(value as RestaurantRole);
}

export function isRestaurantAdminRole(value: string | null | undefined): value is RestaurantAdminRole {
  return typeof value === "string" && RESTAURANT_ADMIN_ROLES.includes(value as RestaurantAdminRole);
}
