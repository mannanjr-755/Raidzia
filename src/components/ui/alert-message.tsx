'use client';

import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type AlertVariant = 'error' | 'success' | 'info';

interface AlertMessageProps {
  variant: AlertVariant;
  message: string;
  className?: string;
}

const icons = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

const styles = {
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  info: 'border-primary/30 bg-primary/10 text-primary',
};

export function AlertMessage({ variant, message, className }: AlertMessageProps) {
  const Icon = icons[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      role="alert"
      aria-live="polite"
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
        styles[variant],
        className
      )}
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </motion.div>
  );
}
