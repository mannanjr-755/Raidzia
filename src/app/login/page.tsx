import type { Metadata } from 'next';
import { AuthLayout } from '@/components/layout/auth-layout';
import { LoginForm } from '@/components/forms/login-form';

export const metadata: Metadata = {
  title: 'Sign In',
};

export default function LoginPage() {
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your accounting dashboard to manage finances, reports, and more."
    >
      <LoginForm />
    </AuthLayout>
  );
}
