import { useNotices } from "@/hooks/queries/useNotices";

export default function WorkerNoticesPage() {
  const { data: notices = [] } = useNotices();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Avisos</h1>
      {notices.length === 0 && <p className="text-sm text-muted-foreground">Sin avisos.</p>}
      {notices.map((n) => (
        <div key={n.id} className="rounded-lg border p-3">
          <p className="font-medium">{n.title}</p>
          {n.message && <p className="text-sm text-muted-foreground">{n.message}</p>}
        </div>
      ))}
    </div>
  );
}
