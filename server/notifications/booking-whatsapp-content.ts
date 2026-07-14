type BookingWhatsAppActionContent = {
  readonly actionPath: string | null;
  readonly variables: Readonly<Record<string, string>>;
};

const BOOKING_SHORT_LINK_ORIGIN = 'https://go.nabatable.com';
const BOOKING_SHORT_LINK_PATH = /^\/m\/[A-Za-z0-9_-]+$/;

export function buildBookingWhatsAppActionContent(params: {
  readonly venueName: string;
  readonly summaryLine: string;
  readonly referenceLine: string;
  readonly manageUrl: string;
}): BookingWhatsAppActionContent {
  let actionPath: string | null = null;

  try {
    const manageUrl = new URL(params.manageUrl);
    if (
      manageUrl.origin === BOOKING_SHORT_LINK_ORIGIN &&
      manageUrl.username.length === 0 &&
      manageUrl.password.length === 0 &&
      manageUrl.search.length === 0 &&
      manageUrl.hash.length === 0 &&
      BOOKING_SHORT_LINK_PATH.test(manageUrl.pathname)
    ) {
      actionPath = manageUrl.pathname.replace(/^\/+/, '');
    }
  } catch {
    actionPath = null;
  }

  return {
    actionPath,
    variables: {
      '1': params.venueName,
      '2': params.summaryLine,
      '3': params.referenceLine,
      '4': params.manageUrl,
      '5': actionPath ?? '',
    },
  };
}
