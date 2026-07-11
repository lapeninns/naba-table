import { beforeEach, describe, expect, it, vi } from 'vitest';

const googleFetchJsonMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/clientTransport', () => ({
  googleFetchJson: googleFetchJsonMock,
}));

import {
  getGoogleBusinessProfileLocationAttributes,
  getGoogleBusinessProfileLocationProfile,
  patchGoogleBusinessProfileLocation,
  updateGoogleBusinessProfileLocationAttributes,
} from '@/server/google-business-profile/clientLocationProfile';
import { GoogleBusinessProfileError } from '@/server/google-business-profile/errors';

const BASE_URL = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const REQUIRED_READ_MASK =
  'name,languageCode,title,storefrontAddress,phoneNumbers,websiteUri,categories,serviceArea,latlng,openInfo,metadata,profile,regularHours,specialHours,moreHours';

const baseProfile = {
  name: 'locations/123',
  title: 'Old Crown',
  phoneNumbers: { primaryPhone: '+441223000000' },
};

function mockProfileFetch({
  base = baseProfile as Record<string, unknown>,
  serviceItems = { serviceItems: [{ structuredServiceItem: {} }] } as Record<string, unknown> | Error,
} = {}) {
  googleFetchJsonMock.mockImplementation(async (url: string) => {
    const mask = new URL(url).searchParams.get('readMask');
    if (mask === 'serviceItems') {
      if (serviceItems instanceof Error) {
        throw serviceItems;
      }
      return serviceItems;
    }
    return base;
  });
}

beforeEach(() => {
  googleFetchJsonMock.mockReset();
});

describe('getGoogleBusinessProfileLocationProfile', () => {
  it('fetches the required read mask and merges the optional serviceItems segment @contract @external-mock', async () => {
    mockProfileFetch();

    const profile = await getGoogleBusinessProfileLocationProfile('token-1', 'locations/123');

    expect(googleFetchJsonMock).toHaveBeenCalledTimes(2);
    const [requiredUrl, requiredToken] = googleFetchJsonMock.mock.calls[0]!;
    expect(new URL(requiredUrl).origin + new URL(requiredUrl).pathname).toBe(
      `${BASE_URL}/locations/123`,
    );
    expect(new URL(requiredUrl).searchParams.get('readMask')).toBe(REQUIRED_READ_MASK);
    expect(requiredToken).toBe('token-1');

    const [optionalUrl, optionalToken] = googleFetchJsonMock.mock.calls[1]!;
    expect(new URL(optionalUrl).pathname.endsWith('/locations/123')).toBe(true);
    expect(new URL(optionalUrl).searchParams.get('readMask')).toBe('serviceItems');
    expect(optionalToken).toBe('token-1');

    expect(profile).toEqual({
      ...baseProfile,
      serviceItems: [{ structuredServiceItem: {} }],
      __nabatableOptionalFetchStatus: { serviceItems: 'fetched' },
    });
  });

  it('normalises bare and whitespace-padded location ids into resource names @contract @external-mock', async () => {
    mockProfileFetch();

    await getGoogleBusinessProfileLocationProfile('token-1', '  123  ');

    const [requiredUrl] = googleFetchJsonMock.mock.calls[0]!;
    expect(new URL(requiredUrl).pathname).toBe('/v1/locations/123');
  });

  it('marks serviceItems unavailable and keeps the base profile when the optional fetch fails @contract @external-mock', async () => {
    mockProfileFetch({
      serviceItems: new GoogleBusinessProfileError('upstream', {
        code: 'GBP_UPSTREAM_ERROR',
        status: 502,
      }),
    });

    const profile = await getGoogleBusinessProfileLocationProfile('token-1', 'locations/123');

    expect(profile).toEqual({
      ...baseProfile,
      __nabatableOptionalFetchStatus: { serviceItems: 'unavailable' },
    });
  });

  it('tolerates empty provider payloads and still reports the optional fetch status @contract @external-mock', async () => {
    mockProfileFetch({ base: {}, serviceItems: {} });

    const profile = await getGoogleBusinessProfileLocationProfile('token-1', 'locations/123');

    expect(profile).toEqual({ __nabatableOptionalFetchStatus: { serviceItems: 'fetched' } });
  });

  it('propagates required-mask fetch failures without attempting the optional segment @contract @external-mock', async () => {
    const authError = new GoogleBusinessProfileError('Google authorization failed', {
      code: 'GBP_FORBIDDEN',
      status: 409,
    });
    googleFetchJsonMock.mockRejectedValue(authError);

    await expect(
      getGoogleBusinessProfileLocationProfile('token-1', 'locations/123'),
    ).rejects.toBe(authError);
    expect(googleFetchJsonMock).toHaveBeenCalledTimes(1);
  });
});

describe('getGoogleBusinessProfileLocationAttributes', () => {
  it('reads attributes for global and bare location ids @contract @external-mock', async () => {
    googleFetchJsonMock.mockResolvedValue({ attributes: [] });

    await getGoogleBusinessProfileLocationAttributes('token-1', 'locations/123');
    await getGoogleBusinessProfileLocationAttributes('token-1', '456');

    expect(googleFetchJsonMock).toHaveBeenNthCalledWith(
      1,
      `${BASE_URL}/locations/123/attributes`,
      'token-1',
    );
    expect(googleFetchJsonMock).toHaveBeenNthCalledWith(
      2,
      `${BASE_URL}/locations/456/attributes`,
      'token-1',
    );
  });

  it('rejects account-scoped location resource names before calling Google @contract', async () => {
    // KNOWN-ISSUE: normalizeGoogleBusinessProfileLocationResourceName prefixes
    // 'accounts/1/locations/2' to 'locations/accounts/1/locations/2', which
    // parseGoogleLocationId then rejects — even though parseGoogleLocationId on
    // its own supports account-scoped names. Callers must pass bare or
    // 'locations/{id}' names; pinning the current composed behavior.
    await expect(
      getGoogleBusinessProfileLocationAttributes('token-1', 'accounts/1/locations/2'),
    ).rejects.toMatchObject({ code: 'GBP_INVALID_LOCATION_NAME', status: 400 });
    expect(googleFetchJsonMock).not.toHaveBeenCalled();
  });
});

describe('updateGoogleBusinessProfileLocationAttributes', () => {
  it('patches attributes with a joined attributeMask and canonical resource name @contract @external-mock', async () => {
    googleFetchJsonMock.mockResolvedValue({ attributes: [{ name: 'attributes/wi_fi' }] });

    const result = await updateGoogleBusinessProfileLocationAttributes(
      'token-1',
      'locations/123',
      { attributes: [{ name: 'attributes/wi_fi', values: [{ boolValue: true }] }] },
      ['attributes/wi_fi', 'attributes/has_delivery'],
    );

    const [url, token, init] = googleFetchJsonMock.mock.calls[0]!;
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/v1/locations/123/attributes');
    expect(parsed.searchParams.get('attributeMask')).toBe(
      'attributes/wi_fi,attributes/has_delivery',
    );
    expect(token).toBe('token-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'locations/123/attributes',
      attributes: [{ name: 'attributes/wi_fi', values: [{ boolValue: true }] }],
    });
    expect(result).toEqual({ attributes: [{ name: 'attributes/wi_fi' }] });
  });
});

describe('patchGoogleBusinessProfileLocation', () => {
  it('patches the location with an updateMask and no validateOnly flag by default @contract @external-mock', async () => {
    googleFetchJsonMock.mockResolvedValue({ name: 'locations/123', title: 'New Name' });

    const result = await patchGoogleBusinessProfileLocation(
      'token-1',
      '123',
      { title: 'New Name' },
      ['title', 'phoneNumbers'],
    );

    const [url, token, init] = googleFetchJsonMock.mock.calls[0]!;
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/v1/locations/123');
    expect(parsed.searchParams.get('updateMask')).toBe('title,phoneNumbers');
    expect(parsed.searchParams.get('validateOnly')).toBeNull();
    expect(token).toBe('token-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ title: 'New Name' });
    expect(result).toEqual({ name: 'locations/123', title: 'New Name' });
  });

  it('adds validateOnly=true for dry-run patches @contract @external-mock', async () => {
    googleFetchJsonMock.mockResolvedValue({});

    await patchGoogleBusinessProfileLocation('token-1', 'locations/123', { title: 'X' }, ['title'], {
      validateOnly: true,
    });

    const [url] = googleFetchJsonMock.mock.calls[0]!;
    expect(new URL(url).searchParams.get('validateOnly')).toBe('true');
  });

  it('propagates transport-level upstream errors from patch calls @contract @external-mock', async () => {
    const upstream = new GoogleBusinessProfileError('Google Business Profile request failed', {
      code: 'GBP_UPSTREAM_ERROR',
      status: 502,
    });
    googleFetchJsonMock.mockRejectedValue(upstream);

    await expect(
      patchGoogleBusinessProfileLocation('token-1', 'locations/123', { title: 'X' }, ['title']),
    ).rejects.toBe(upstream);
  });
});
