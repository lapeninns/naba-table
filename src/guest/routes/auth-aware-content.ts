export type GuestActionContent = {
  href: string;
  label: string;
};

export type GuestBookingsLandingContent = {
  headerDescription: string;
  secondaryAction: GuestActionContent;
  existingTitle: string;
  existingDescription: string;
  existingAction: GuestActionContent;
  messageLinkDescription: string;
};

const GUEST_BOOKINGS_PATH = '/guest/bookings';
const SIGN_IN_FOR_BOOKINGS_PATH = '/auth/signin?redirectedFrom=/guest/bookings';

export function getGuestBookingsAccessAction(isAuthenticated: boolean): GuestActionContent {
  return isAuthenticated
    ? { href: GUEST_BOOKINGS_PATH, label: 'My bookings' }
    : { href: SIGN_IN_FOR_BOOKINGS_PATH, label: 'Sign in' };
}

export function getGuestBookingsLandingContent(
  isAuthenticated: boolean,
): GuestBookingsLandingContent {
  const accessAction = getGuestBookingsAccessAction(isAuthenticated);

  if (isAuthenticated) {
    return {
      headerDescription:
        'Choose a restaurant, pick a time, and confirm your next table. Your saved bookings and receipts stay in your guest portal.',
      secondaryAction: accessAction,
      existingTitle: 'Manage your bookings',
      existingDescription:
        'Open upcoming bookings, past visits, and receipts saved to your guest account.',
      existingAction: { href: GUEST_BOOKINGS_PATH, label: 'Open my bookings' },
      messageLinkDescription:
        'Confirmation links still open the matching booking directly. Your guest portal also keeps saved bookings and receipts in one place.',
    };
  }

  return {
    headerDescription:
      'Choose a restaurant, pick a time, and confirm your table. Already booked? Sign in with your reservation email to view bookings and receipts.',
    secondaryAction: accessAction,
    existingTitle: 'View existing bookings',
    existingDescription:
      'See bookings saved to your guest account. Opening a booking link while signed in saves it there.',
    existingAction: { href: SIGN_IN_FOR_BOOKINGS_PATH, label: 'Sign in to view bookings' },
    messageLinkDescription:
      'Confirmation links open the matching booking directly. If a link has expired, request a new one: it goes to the email address on your booking.',
  };
}

export function getBookingRecoveryPrimaryAction(isAuthenticated: boolean): GuestActionContent {
  return isAuthenticated
    ? { href: GUEST_BOOKINGS_PATH, label: 'Open my bookings' }
    : { href: '/auth/signin', label: 'Sign in' };
}

export function getReservationThankYouContent(
  isAuthenticated: boolean,
  restaurantName: string,
): {
  description: string;
  primaryAction: GuestActionContent;
} {
  return isAuthenticated
    ? {
        description: `Your table request for ${restaurantName} is in. You can open your guest portal to keep track of saved bookings and receipts.`,
        primaryAction: { href: GUEST_BOOKINGS_PATH, label: 'View my bookings' },
      }
    : {
        description: `Your table request for ${restaurantName} is in. Check your inbox for confirmation details, or sign in with the booking email to keep it with your guest portal.`,
        primaryAction: {
          href: SIGN_IN_FOR_BOOKINGS_PATH,
          label: 'Sign in to view bookings',
        },
      };
}
