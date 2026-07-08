'use client';

import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      position="top-right"
      toastOptions={{
        classNames: {
          toast: 'glass border-border shadow-lg',
          title: 'text-foreground',
          description: 'text-muted-foreground',
        },
      }}
      richColors
      closeButton
    />
  );
}
