import { PROFILE_NAMES, type ProfileName } from '../contracts/primitives';
import type { CiProfile } from '../contracts/profile';
import { mainProfile } from './main';
import { nightlyProfile } from './nightly';
import { prProfile } from './pr';

export const PROFILES: Readonly<Record<ProfileName, CiProfile>> = {
  pr: prProfile,
  main: mainProfile,
  nightly: nightlyProfile,
};

export function isProfileName(value: string): value is ProfileName {
  return (PROFILE_NAMES as readonly string[]).includes(value);
}

export function getProfile(name: ProfileName): CiProfile {
  return PROFILES[name];
}

export { PROFILE_NAMES };
