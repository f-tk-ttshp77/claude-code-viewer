'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';

export function GlobalNav() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Sessions' },
    { href: '/analytics', label: 'Analytics' },
    { href: '/insights', label: 'Insights' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-8">
        <Link href="/" className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Claude Code Viewer
        </Link>
        <nav className="flex items-center gap-4 sm:gap-6">
          {links.map((link) => {
            const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm transition-colors ${
                  isActive
                    ? 'font-semibold text-gray-900 underline underline-offset-4 dark:text-gray-100'
                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
