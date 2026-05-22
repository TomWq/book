import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isDesktopRuntime } from "@/lib/app-runtime";
import { getCurrentUserAccess } from "@/lib/projects";

export default async function ProjectsLayout({ children }: { children: ReactNode }) {
  const { isAdmin } = await getCurrentUserAccess();

  if (isAdmin && !isDesktopRuntime()) {
    redirect("/admin");
  }

  return children;
}
