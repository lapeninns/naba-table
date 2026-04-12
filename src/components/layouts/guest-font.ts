import { Inter, Manrope } from 'next/font/google';

export const guestHeading = Manrope({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-guest-heading',
});

export const guestBody = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-guest-body',
});

export const guestSans = guestBody;
