import { createGoogleJsonTransport, type GoogleTransportDependencies } from './clientTransport';
import { GoogleBusinessProfileError } from './errors';
import {
  googleAttributesSchema,
  googleFoodMenusSchema,
  googleLocationSchema,
} from './providerSchemas';
import { executeGoogleWrite, type GoogleWritePermit } from './writePermit';

const BUSINESS_INFORMATION_ORIGIN = 'https://mybusinessbusinessinformation.googleapis.com';
const MY_BUSINESS_ORIGIN = 'https://mybusiness.googleapis.com';

type MutationClientConfig = {
  readonly accessToken: string;
  readonly quotaProject?: string | null;
  readonly dependencies?: GoogleTransportDependencies;
};

export class GoogleWritePreDispatchError extends GoogleBusinessProfileError {
  constructor() {
    super('Google listing write could not be dispatched.', {
      code: 'GBP_WRITE_PRE_DISPATCH_FAILED',
      status: 409,
    });
    this.name = 'GoogleWritePreDispatchError';
  }
}

export function isGoogleWritePreDispatchError(
  error: unknown,
): error is GoogleWritePreDispatchError {
  return error instanceof GoogleWritePreDispatchError;
}

function transport(config: MutationClientConfig, origin: string) {
  return createGoogleJsonTransport({
    origin,
    accessToken: config.accessToken,
    quotaProject: config.quotaProject,
    ...config.dependencies,
  });
}

export function createGoogleListingMutationClient(config: MutationClientConfig) {
  const client = transport(config, BUSINESS_INFORMATION_ORIGIN);
  return {
    patchLocation(params: {
      readonly permit: GoogleWritePermit;
      readonly locationId: string;
      readonly updateMasks: readonly string[];
      readonly payload: unknown;
    }) {
      const resource = `locations/${params.locationId}`;
      return executeGoogleWrite({
        permit: params.permit,
        method: 'PATCH',
        resource,
        updateMasks: params.updateMasks,
        payload: params.payload,
        dispatch: () =>
          client.request(`v1/${resource}`, googleLocationSchema, {
            method: 'PATCH',
            searchParams: { updateMask: [...params.updateMasks].sort().join(',') },
            json: params.payload,
          }),
      });
    },
    updateAttributes(params: {
      readonly permit: GoogleWritePermit;
      readonly locationId: string;
      readonly attributeMasks: readonly string[];
      readonly payload: unknown;
    }) {
      const resource = `locations/${params.locationId}/attributes`;
      return executeGoogleWrite({
        permit: params.permit,
        method: 'PATCH',
        resource,
        updateMasks: params.attributeMasks,
        payload: params.payload,
        dispatch: () =>
          client.request(`v1/${resource}`, googleAttributesSchema, {
            method: 'PATCH',
            searchParams: { attributeMask: [...params.attributeMasks].sort().join(',') },
            json: params.payload,
          }),
      });
    },
  };
}

export function createGoogleFoodMenusMutationClient(config: MutationClientConfig) {
  const infoClient = transport(config, BUSINESS_INFORMATION_ORIGIN);
  const menusClient = transport(config, MY_BUSINESS_ORIGIN);
  return {
    async replace(params: {
      readonly permit: GoogleWritePermit;
      readonly accountId: string;
      readonly locationId: string;
      readonly payload: unknown;
    }) {
      const metadataOnly = googleLocationSchema.pick({ name: true, metadata: true });
      let location: { readonly metadata?: { readonly canHaveFoodMenus?: boolean } };
      try {
        location = await infoClient.request(
          `v1/locations/${encodeURIComponent(params.locationId)}`,
          metadataOnly,
          { searchParams: { readMask: 'name,metadata' } },
        );
      } catch (error) {
        if (error instanceof GoogleBusinessProfileError) {
          throw new GoogleWritePreDispatchError();
        }
        throw error;
      }
      if (location.metadata?.canHaveFoodMenus !== true) {
        throw new GoogleWritePreDispatchError();
      }
      const payload = googleFoodMenusSchema.parse(params.payload);
      const resource = `accounts/${params.accountId}/locations/${params.locationId}/foodMenus`;
      return executeGoogleWrite({
        permit: params.permit,
        method: 'PATCH',
        resource,
        updateMasks: ['menus'],
        payload,
        dispatch: () =>
          menusClient.request(`v4/${resource}`, googleFoodMenusSchema, {
            method: 'PATCH',
            searchParams: { updateMask: 'menus' },
            json: payload,
          }),
      });
    },
  };
}
