import { describe, it, expect } from 'vitest';

import nextConfig from "../../next.config.js";

interface Redirect {
  source: string;
  destination: string;
  permanent: boolean;
  // Add other properties if needed for more comprehensive type checking
}

describe('Routing Redirects', () => {
  it('should have canonical redirects configured', async () => {
    const redirects = await nextConfig.redirects();

    const assertRedirect = (source: string, destination: string) => {
      const rule = redirects.find((r: Redirect) => r.source === source);
      expect(rule, `Redirect for ${source} not found`).toBeDefined();
      expect(rule?.destination).toBe(destination);
      expect(rule?.permanent).toBe(true);
    };

    // Auth
    assertRedirect('/signin', '/auth/signin');
    assertRedirect('/guest/signin', '/auth/signin');

    // Discovery
    assertRedirect('/guest/restaurants', '/restaurants');
    assertRedirect('/browse', '/restaurants');

    // Booking
    assertRedirect('/reserve', '/bookings');
    assertRedirect('/booking', '/bookings');
    assertRedirect('/reserve/r/:slug', '/restaurants/:slug/book');
    
    // Account
    assertRedirect('/account', '/guest');
    assertRedirect('/my-bookings', '/guest/bookings');
  });
});
