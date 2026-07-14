'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import logo from '../../assets/logo.jpg';

import {
  LayoutDashboard,
  FolderKanban,
  MapPin,
  Building2,
  Users,
  ShoppingCart,
  Calculator,
  Receipt,
  Package,
  UserCog,
  ClipboardList,
  Box,
  BarChart3,
  Bell,
  LogOut,
  KeyRound,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/land-bank', label: 'Land Bank', icon: MapPin },
  { href: '/properties', label: 'Properties', icon: Building2 },
  { href: '/crm', label: 'CRM', icon: Users },
  { href: '/sales', label: 'Sales', icon: ShoppingCart },
  { href: '/accounting', label: 'Accounting', icon: Calculator },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/hr', label: 'HR', icon: UserCog },
  { href: '/project-feasibility', label: 'Project Feasibility', icon: ClipboardList },
  { href: '/digital-twin', label: 'Digital Twin', icon: Box },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/notifications', label: 'Notifications', icon: Bell },
];

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-luxury-border bg-white shadow-card"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-luxury-border p-4">
        <Image
          src={logo}
          alt="RSS Builder Developer"
          width={40}
          height={40}
          className="rounded-md"
        />

        {!collapsed && (
          <span className="text-lg font-bold">
            RSS Builder Developer
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'sidebar-link',
                isActive && 'sidebar-link-active',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-luxury-border p-3 space-y-2">
        {!collapsed && user && (
          <div className="rounded-lg bg-luxury-cream px-3 py-2">
            <p className="truncate text-sm font-medium">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-xs">
              {user.role}
            </p>
          </div>
        )}

        <Link
          href="/change-password"
          className={cn(
            'sidebar-link w-full',
            pathname.startsWith('/change-password') && 'sidebar-link-active',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? 'Change Password' : undefined}
        >
          <KeyRound className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Change Password</span>}
        </Link>

        <button
          onClick={() => logout()}
          className={cn(
            'sidebar-link w-full text-red-600 hover:bg-red-50',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>

        <button
          onClick={() => onCollapsedChange(!collapsed)}
          className={cn(
            'sidebar-link w-full',
            collapsed && 'justify-center px-2'
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}

          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </motion.aside>
  );
}