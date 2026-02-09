'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

function buildBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (pathname === '/') {
    return [];
  }

  if (pathname === '/analytics') {
    return [{ label: 'Home', href: '/' }, { label: 'Analytics' }];
  }

  if (pathname === '/insights') {
    return [{ label: 'Home', href: '/' }, { label: 'Insights' }];
  }

  // /session/[project]/[id]
  const sessionMatch = pathname.match(/^\/session\/([^/]+)\/([^/]+)/);
  if (sessionMatch) {
    const project = decodeURIComponent(sessionMatch[1]);
    const sessionId = sessionMatch[2];
    return [
      { label: 'Home', href: '/' },
      { label: project.length > 20 ? project.slice(0, 20) + '...' : project },
      { label: sessionId.slice(0, 8) },
    ];
  }

  return [];
}

export function Breadcrumb() {
  const pathname = usePathname();
  const items = buildBreadcrumbs(pathname);

  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-gray-500 dark:text-gray-400">
      <ol className="flex items-center gap-1.5">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1.5">
            {index > 0 && <span aria-hidden="true">&gt;</span>}
            {item.href ? (
              <Link
                href={item.href}
                className="hover:text-gray-900 hover:underline dark:hover:text-gray-100"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-gray-700 dark:text-gray-300">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
