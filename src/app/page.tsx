import { redirect } from 'next/navigation';
import { ROUTES } from '@/lib/constants/auth';

export default function HomePage() {
  redirect(ROUTES.login);
}
