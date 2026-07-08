import Image from 'next/image';
import Link from 'next/link';
import { APP_NAME, APP_TAGLINE } from '@/lib/constants/auth';

interface AuthLogoProps {
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: { icon: 32, text: 'text-lg' },
  md: { icon: 40, text: 'text-xl' },
  lg: { icon: 48, text: 'text-2xl' },
};

export function AuthLogo({ size = 'md' }: AuthLogoProps) {
  const { icon, text } = sizes[size];

  return (
    <Link href="/login" className="flex items-center gap-3 group" aria-label={`${APP_NAME} home`}>
      <div className="relative flex items-center justify-center rounded-xl bg-primary/10 p-2 ring-1 ring-primary/20 transition-transform group-hover:scale-105">
        <Image
          src="/logo.svg"
          alt=""
          width={icon}
          height={icon}
          priority
          aria-hidden="true"
        />
      </div>
      <div className="flex flex-col">
        <span className={`font-bold tracking-tight ${text}`}>{APP_NAME}</span>
        <span className="text-xs text-muted-foreground hidden sm:block">{APP_TAGLINE}</span>
      </div>
    </Link>
  );
}
