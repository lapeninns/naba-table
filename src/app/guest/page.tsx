import { redirect } from 'next/navigation';

export default function GuestHome() {
  redirect('/guest/dashboard');
}
