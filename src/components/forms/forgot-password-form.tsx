'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import { Mail, ArrowLeft } from 'lucide-react';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '@/lib/validation/schemas';
import { authService } from '@/services/auth.service';
import { ROUTES, AUTH_ERRORS } from '@/lib/constants/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertMessage } from '@/components/ui/alert-message';

export function ForgotPasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setServerError(null);
    setSuccessMessage(null);

    const result = await authService.forgotPassword(data);

    if (!result.success) {
      setServerError(result.error || AUTH_ERRORS.generic);
      return;
    }

    setSuccessMessage(result.message);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <AnimatePresence mode="wait">
        {serverError && <AlertMessage key="error" variant="error" message={serverError} />}
        {successMessage && <AlertMessage key="success" variant="success" message={successMessage} />}
      </AnimatePresence>

      <div className="space-y-2">
        <Label htmlFor="email">Gmail Address</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="you@gmail.com"
          icon={<Mail className="h-4 w-4" />}
          error={!!errors.email}
          disabled={isSubmitting || !!successMessage}
          aria-invalid={!!errors.email}
          {...register('email')}
        />
        {errors.email && (
          <p className="text-xs text-destructive" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full"
        size="lg"
        loading={isSubmitting}
        disabled={isSubmitting || !!successMessage}
      >
        {isSubmitting ? 'Sending...' : 'Send reset link'}
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
