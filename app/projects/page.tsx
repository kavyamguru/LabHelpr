import CreateProjectForm from "./CreateProjectForm";

export default async function ProjectsPage() {
  const baseUrl = "http://127.0.0.1:8000";

  const res = await fetch(`${baseUrl}/projects`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Projects</h1>
        <p>Failed to load projects. Status: {res.status}</p>
      </main>
    );
  }

  const projects: Array<{
    id: number;
    name: string;
    description?: string | null;
    created_at: string;
  }> = await res.json();

  return (
    <main style={{ padding: 24 }}>
      <h1>Projects</h1>

      <CreateProjectForm />

      {projects.length === 0 ? (
        <p>No projects yet.</p>
      ) : (
        <ul style={{ marginTop: 16 }}>
          {projects.map((p) => (
            <li key={p.id} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              {p.description ? <div>{p.description}</div> : null}
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Created: {new Date(p.created_at).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

