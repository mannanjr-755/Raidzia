'use client';

import { motion } from 'framer-motion';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { AuthLogo } from '@/components/auth/auth-logo';
import { APP_NAME } from '@/lib/constants/auth';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen auth-gradient flex flex-col">
      <header className="flex items-center justify-between p-4 sm:p-6">
        <AuthLogo />
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-2xl sm:text-3xl font-bold tracking-tight"
            >
              {title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-2 text-muted-foreground text-sm sm:text-base"
            >
              {subtitle}
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="glass rounded-2xl p-6 sm:p-8 shadow-glass-lg"
          >
            {children}
          </motion.div>
        </motion.div>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
        <p className="mt-1">Secure enterprise accounting platform</p>
      </footer>
    </div>
  );
}
