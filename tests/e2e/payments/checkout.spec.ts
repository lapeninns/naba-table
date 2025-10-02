import { expect, test } from '../../fixtures/auth';
import { pricingSelectors } from '../../helpers/selectors';

const mockCheckoutParam = /mockCheckout=1/;

test.describe('pricing checkout', () => {
  test('redirects via Stripe mock mode', async ({ authedPage, baseURL }) => {
    test.skip(!baseURL, 'Base URL must be configured.');

    await authedPage.goto('/pricing');
    await pricingSelectors.planButton(authedPage, 'Advanced').click();

    await authedPage.waitForURL(mockCheckoutParam);
    await expect(authedPage).toHaveURL(mockCheckoutParam);
  });
});
