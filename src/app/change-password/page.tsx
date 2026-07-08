import type { Metadata } from 'next';
import { AuthLayout } from '@/components/layout/auth-layout';
import { ChangePasswordForm } from '@/components/forms/change-password-form';

export const metadata: Metadata = {
  title: 'Change Password',
};

export default function ChangePasswordPage() {
  return (
    <AuthLayout
      title="Change your password"
      subtitle="Update your password to keep your account secure."
    >
      <ChangePasswordForm />
    </AuthLayout>
  );
}
