'use client';

import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Building2, Lock, Mail } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { ApiError } from '@/lib/api';
import Image from "next/image";
import logo from "../../assets/logo.jpg";

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginForm() {
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (searchParams.get('passwordChanged') === '1') {
      toast.success('Your password has been changed successfully. Please sign in.');
    }
  }, [searchParams]);

  const onSubmit = async (data: LoginFormValues) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
      toast.success('Welcome back!');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-luxury-charcoal">
        <div className="absolute inset-0 bg-gold-gradient opacity-10" />
        <div className="relative z-10 flex flex-col justify-center px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
           <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-md p-2">
  <Image
    src={logo}
    alt="RSS ERP Logo"
    width={40}
    height={40}
    className="object-contain"
    priority
  />
</div>
            <h2 className="text-4xl font-display text-white leading-tight mb-4">
              Rehan Shahid & Sons
              <br />
              <span className="text-gold">Builders & Developers</span>
            </h2>
            <p className="text-luxury-slate/80 text-lg max-w-md leading-relaxed">
              Premium enterprise platform for project management, land acquisition,
              sales, accounting, and digital twin visualization.
            </p>
            <div className="mt-12 flex gap-8">
              {['Projects', 'Land Bank', 'Sales', 'Digital Twin'].map((item) => (
                <div key={item} className="text-center">
                  <div className="h-1 w-8 bg-gold mx-auto mb-2 rounded-full" />
                  <span className="text-sm text-gold-200">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold-gradient text-white font-bold">
              RSS
            </div>
            <div>
              <p className="font-bold text-luxury-charcoal">RSS ERP</p>
              <p className="text-xs text-luxury-slate">Rehan Shahid & Sons</p>
            </div>
          </div>

          <div className="luxury-card p-8">
            <div className="mb-8">
              <div className="gold-accent-line mb-4" />
              <h2 className="text-2xl font-bold text-luxury-charcoal">Sign In</h2>
              <p className="text-sm text-luxury-slate mt-1">
                Access your construction management dashboard
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-luxury-charcoal mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-luxury-slate" />
                  <input
                    {...register('email')}
                    type="email"
                    className="luxury-input pl-10"
                    placeholder="admin@rssbuilders.com"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-luxury-charcoal mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-luxury-slate" />
                  <input
                    {...register('password')}
                    type="password"
                    className="luxury-input pl-10"
                    placeholder="••••••••"
                  />
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
                )}
                <div className="mt-2 flex justify-end">
                  <Link
                    href="/change-password"
                    className="text-sm text-gold hover:text-gold-600 transition-colors"
                  >
                    Change Password
                  </Link>
                </div>
              </div>

              <button type="submit" className="btn-gold w-full" disabled={loading}>
                <Building2 className="h-4 w-4" />
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-luxury-slate mt-6">
            © {new Date().getFullYear()} RSS ERP — Rehan Shahid & Sons Builders & Developers
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-luxury-slate">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
