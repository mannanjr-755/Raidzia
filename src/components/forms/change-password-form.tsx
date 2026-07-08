'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { changePasswordSchema, type ChangePasswordFormValues } from '@/lib/validation/schemas';
import { authService } from '@/services/auth.service';
import { ROUTES, AUTH_ERRORS } from '@/lib/constants/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertMessage } from '@/components/ui/alert-message';

function PasswordField({
  id,
  label,
  show,
  onToggle,
  error,
  disabled,
  register,
}: {
  id: string;
  label: string;
  show: boolean;
  onToggle: () => void;
  error?: string;
  disabled: boolean;
  register: ReturnType<typeof useForm<ChangePasswordFormValues>>['register'];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete={id === 'currentPassword' ? 'current-password' : 'new-password'}
          placeholder={`Enter ${label.toLowerCase()}`}
          icon={<Lock className="h-4 w-4" />}
          error={!!error}
          disabled={disabled}
          aria-invalid={!!error}
          {...register(id as keyof ChangePasswordFormValues)}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={show ? 'Hide password' : 'Show password'}
          tabIndex={-1}
          disabled={disabled}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function ChangePasswordForm() {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ChangePasswordFormValues) => {
    setServerError(null);
    setSuccessMessage(null);

    const result = await authService.changePassword(data);

    if (!result.success) {
      setServerError(result.error || AUTH_ERRORS.generic);
      return;
    }

    setSuccessMessage(result.message || 'Password updated successfully.');
    reset();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <AnimatePresence mode="wait">
        {serverError && <AlertMessage key="error" variant="error" message={serverError} />}
        {successMessage && <AlertMessage key="success" variant="success" message={successMessage} />}
      </AnimatePresence>

      <PasswordField
        id="currentPassword"
        label="Current Password"
        show={showCurrent}
        onToggle={() => setShowCurrent(!showCurrent)}
        error={errors.currentPassword?.message}
        disabled={isSubmitting}
        register={register}
      />

      <PasswordField
        id="newPassword"
        label="New Password"
        show={showNew}
        onToggle={() => setShowNew(!showNew)}
        error={errors.newPassword?.message}
        disabled={isSubmitting}
        register={register}
      />

      <PasswordField
        id="confirmPassword"
        label="Confirm Password"
        show={showConfirm}
        onToggle={() => setShowConfirm(!showConfirm)}
        error={errors.confirmPassword?.message}
        disabled={isSubmitting}
        register={register}
      />

      <Button type="submit" className="w-full" size="lg" loading={isSubmitting} disabled={isSubmitting}>
        {isSubmitting ? 'Updating...' : 'Update password'}
      </Button>

      <Link
        href={ROUTES.login}
        className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </Link>
    </form>
  );
}
