import { CiProfileSchema, type CiProfile } from '../contracts/profile';
import { assertWith } from '../contracts/validation';

/** Profiles are static data; validating at definition time makes an invalid profile a load error. */
export function defineProfile(profile: CiProfile): CiProfile {
  return Object.freeze(assertWith(CiProfileSchema, profile, `CiProfile ${profile.name}`));
}
