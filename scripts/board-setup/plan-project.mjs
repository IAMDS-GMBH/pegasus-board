// Finds the board's project by its slug (the task-ID prefix, unique per
// workspace and compared case-insensitively by the API).
export function planProject(spec, projects) {
  const slug = spec.slug.toLowerCase();
  const project = projects.find((p) => p.slug.toLowerCase() === slug);

  if (!project) return { action: { type: "create-project", project: spec } };
  if (project.archivedAt) {
    return {
      error: `Projekt „${project.name}“ (${project.slug}) ist archiviert. Bitte zuerst in Kaneo wiederherstellen.`,
    };
  }

  const warnings =
    project.name === spec.name
      ? []
      : [
          `Projekt ${project.slug} heißt „${project.name}“ statt „${spec.name}“; der Name bleibt unverändert.`,
        ];
  return { project, warnings };
}
