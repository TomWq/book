"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type ProjectNavItem = {
  key: string;
  label: string;
  href: string;
  exact?: boolean;
};

export function ProjectNav({
  projectId,
  items
}: {
  projectId: string;
  items: ProjectNavItem[];
}) {
  const pathname = usePathname();
  const basePath = `/projects/${projectId}`;

  return (
    <div className="tag-row project-step-nav" aria-label="项目步骤导航">
      {items.map((item) => {
        const href = `${basePath}/${item.href}`.replace(/\/$/, "");
        const isActive = item.href
          ? item.exact
            ? pathname === href
            : pathname.startsWith(href)
          : pathname === basePath;

        return (
          <Link
            key={item.key}
            href={href}
            className={`button project-step-link${isActive ? " active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
