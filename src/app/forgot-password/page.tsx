import type { Metadata } from 'next';
import { AuthLayout } from '@/components/layout/auth-layout';
import { ForgotPasswordForm } from '@/components/forms/forgot-password-form';

export const metadata: Metadata = {
  title: 'Forgot Password',
};

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your Gmail address and we'll send you a link to reset your password."
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
