import type { OnboardingResume, OnboardingState } from './types';

/**
 * Merges what the server knows (session, memberships) into the restored draft.
 *
 * - No resume (server lookup unavailable): keep the draft as it is.
 * - Signed out: keep the draft; its writes will ask the user to sign in.
 * - Signed in and the draft's restaurant is one of the user's: keep the draft.
 * - Signed in with an unfinished restaurant and no matching draft (new tab after the
 *   confirmation link, or a closed tab): continue that restaurant.
 * - Signed in with a finished restaurant: flag `alreadyOnboarded`, never re-run setup
 *   over a restaurant that may already take bookings.
 * - Signed in with no restaurant: drop a stale draft restaurant (another account's).
 */
export function applyServerResume(
  state: OnboardingState,
  resume: OnboardingResume | undefined,
  defaults: OnboardingState,
): OnboardingState {
  if (!resume) {
    return state;
  }
  if (!resume.session) {
    return { ...state, session: null, alreadyOnboarded: false };
  }

  const session = resume.session;
  if (state.restaurantId && resume.memberRestaurantIds.includes(state.restaurantId)) {
    return { ...state, session, alreadyOnboarded: false };
  }

  const draftBelongsToSomeoneElse = state.restaurantId !== null;
  const base: OnboardingState = draftBelongsToSomeoneElse
    ? { ...defaults, step: state.step, account: state.account }
    : state;

  if (resume.resumeRestaurant) {
    const restaurant = resume.resumeRestaurant;
    // The draft was lost (new tab or another device), so the steps show what is saved on the
    // server rather than defaults; saving them again then keeps the owner's earlier work.
    const setup = restaurant.setup;
    return {
      ...base,
      ...(setup
        ? {
            operatingHours: setup.operatingHours,
            servicePeriods: setup.servicePeriods,
            zones: setup.zones,
            tables: setup.tables,
          }
        : {}),
      session,
      alreadyOnboarded: false,
      restaurantId: restaurant.id,
      profile: {
        ...base.profile,
        name: restaurant.name,
        slug: restaurant.slug,
        timezone: restaurant.timezone,
      },
    };
  }

  return {
    ...base,
    session,
    restaurantId: null,
    alreadyOnboarded: resume.memberRestaurantIds.length > 0,
  };
}
