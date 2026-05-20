"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SideNavItem = {
  href: string;
  label: string;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav({ items }: { items: SideNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="side-nav" aria-label="全局导航">
      {items.map((item) => {
        const active = items.length === 1 || isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`side-nav-link ${active ? "active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
