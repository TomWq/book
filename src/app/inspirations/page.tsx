import { InspirationWorkbench } from "@/components/inspiration-workbench";
import { getInspirations, getProjects } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function InspirationsPage({
  searchParams
}: {
  searchParams?: Promise<{ projectId?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const [inspirations, projects] = await Promise.all([
    getInspirations(),
    getProjects()
  ]);
  const initialProjectId = projects.some((project) => project.id === params.projectId)
    ? params.projectId
    : "";

  return (
    <InspirationWorkbench
      initialInspirations={inspirations}
      projects={projects}
      initialProjectId={initialProjectId}
    />
  );
}
