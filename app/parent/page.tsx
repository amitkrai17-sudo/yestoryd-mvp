import { redirect } from 'next/navigation';

export default function Parent() {
  redirect('/parent/dashboard');
}
