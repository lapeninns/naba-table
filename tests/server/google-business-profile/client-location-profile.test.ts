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
  serviceItems = { serviceItems: [{ structuredServiceItem: {} }] } as
    | Record<string, unknown>
    | Error,
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
      __nabatableRawResponses: [baseProfile, { serviceItems: [{ structuredServiceItem: {} }] }],
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
      __nabatableRawResponses: [baseProfile],
    });
  });

  it('tolerates empty provider payloads and still reports the optional fetch status @contract @external-mock', async () => {
    mockProfileFetch({ base: {}, serviceItems: {} });

    const profile = await getGoogleBusinessProfileLocationProfile('token-1', 'locations/123');

    expect(profile).toEqual({
      __nabatableOptionalFetchStatus: { serviceItems: 'fetched' },
      __nabatableRawResponses: [{}, {}],
    });
  });

  it('propagates required-mask fetch failures without attempting the optional segment @contract @external-mock', async () => {
    const authError = new GoogleBusinessProfileError('Google authorization failed', {
      code: 'GBP_FORBIDDEN',
      status: 409,
    });
    googleFetchJsonMock.mockRejectedValue(authError);

    await expect(getGoogleBusinessProfileLocationProfile('token-1', 'locations/123')).rejects.toBe(
      authError,
    );
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
  it('retires legacy attribute writes before transport dispatch @contract', async () => {
    await expect(
      updateGoogleBusinessProfileLocationAttributes(
        'token-1',
        'locations/123',
        { attributes: [] },
        ['attributes/wi_fi'],
      ),
    ).rejects.toMatchObject({ code: 'GBP_LEGACY_GOOGLE_WRITE_RETIRED' });
    expect(googleFetchJsonMock).not.toHaveBeenCalled();
  });
});

describe('patchGoogleBusinessProfileLocation', () => {
  it('retires legacy location writes before transport dispatch @contract', async () => {
    await expect(
      patchGoogleBusinessProfileLocation('token-1', 'locations/123', { title: 'X' }, ['title']),
    ).rejects.toMatchObject({ code: 'GBP_LEGACY_GOOGLE_WRITE_RETIRED' });
    expect(googleFetchJsonMock).not.toHaveBeenCalled();
  });
});
