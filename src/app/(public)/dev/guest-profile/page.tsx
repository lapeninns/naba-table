import { GuestLayout } from '@/components/layouts/GuestLayout';

import { enforceDevOnly } from '../_shared/enforceDevOnly';
import { GuestProfileDevHarness } from './ui/GuestProfileDevHarness';

export const metadata = {
  title: 'Dev: Guest profile',
};

export default function GuestProfileDevPage() {
  enforceDevOnly();

  return (
    <GuestLayout>
      <GuestProfileDevHarness />
    </GuestLayout>
  );
}
