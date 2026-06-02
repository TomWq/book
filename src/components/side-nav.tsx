"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SideNavItem = {
  href: string;
  label: string;
  fullReload?: boolean;
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

        const className = `side-nav-link ${active ? "active" : ""}`;
        const ariaCurrent = active ? "page" : undefined;

        return item.fullReload ? (
          <a key={item.href} href={item.href} className={className} aria-current={ariaCurrent}>
            {item.label}
          </a>
        ) : (
          <Link key={item.href} href={item.href} className={className} aria-current={ariaCurrent}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
