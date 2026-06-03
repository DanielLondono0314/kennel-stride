import { useParams } from "react-router-dom";

export default function WorkerTaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Detalle</h1>
      <p className="text-sm text-muted-foreground">
        El detalle y las acciones de este elemento ({id}) estarán disponibles próximamente.
      </p>
    </div>
  );
}
