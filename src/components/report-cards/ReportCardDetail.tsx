import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "./StarRating";
import { supabase } from "@/integrations/supabase/client";
import { mockDogs, mockCustomers } from "@/data/mockData";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Dog, PawPrint } from "lucide-react";

interface ReportCardDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportCard: any;
  trainerName?: string;
}

export function ReportCardDetail({ open, onOpenChange, reportCard, trainerName }: ReportCardDetailProps) {
  const [history, setHistory] = useState<any[]>([]);

  const dog = mockDogs.find((d) => d.id === reportCard?.dog_id);
  const customer = dog ? mockCustomers.find((c) => c.id === dog.customerId) : null;

  useEffect(() => {
    if (open && reportCard?.dog_id) {
      loadHistory(reportCard.dog_id);
    }
  }, [open, reportCard?.dog_id]);

  async function loadHistory(dogId: string) {
    const { data } = await supabase
      .from("report_cards")
      .select("session_date, overall_score, energy_level, socialization, obedience, appetite")
      .eq("dog_id", dogId)
      .order("session_date", { ascending: true })
      .limit(10);
    if (data) setHistory(data);
  }

  if (!reportCard) return null;

  const metrics = [
    { label: "General", value: reportCard.overall_score },
    { label: "Energía", value: reportCard.energy_level },
    { label: "Socialización", value: reportCard.socialization },
    { label: "Obediencia", value: reportCard.obedience },
    { label: "Apetito", value: reportCard.appetite },
  ];

  const chartData = history.map((h) => ({
    date: format(new Date(h.session_date), "dd/MM"),
    general: h.overall_score,
    energía: h.energy_level,
    social: h.socialization,
    obediencia: h.obedience,
  }));

  const serviceLabels: Record<string, string> = {
    daycare: "Guardería",
    board_and_train: "Internado + Entrenamiento",
    training_session: "Sesión de Entrenamiento",
    grooming: "Grooming",
    evaluation: "Evaluación",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PawPrint className="h-5 w-5 text-accent" />
            Report Card — {reportCard.dog_name}
          </DialogTitle>
        </DialogHeader>

        {/* Dog profile */}
        <div className="flex items-start gap-4 bg-muted/50 rounded-lg p-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Dog className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg">{reportCard.dog_name}</h3>
            {dog && (
              <p className="text-sm text-muted-foreground">
                {dog.breed} · {dog.weight}kg · {dog.gender === "male" ? "Macho" : "Hembra"}
              </p>
            )}
            {customer && (
              <p className="text-sm text-muted-foreground">
                Dueño: {customer.firstName} {customer.lastName}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline">{serviceLabels[reportCard.service_type] || reportCard.service_type}</Badge>
              <Badge variant={reportCard.is_sent ? "default" : "secondary"}>
                {reportCard.is_sent ? "Enviado" : "Borrador"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {format(new Date(reportCard.session_date), "PPP", { locale: es })}
              </span>
            </div>
          </div>
        </div>

        {/* Trainer */}
        {trainerName && (
          <p className="text-sm text-muted-foreground">
            Entrenador: <span className="font-medium text-foreground">{trainerName}</span>
          </p>
        )}

        {/* Metrics */}
        <div className="space-y-2">
          <h4 className="font-semibold">Métricas</h4>
          <div className="grid gap-2 bg-muted/30 rounded-lg p-3">
            {metrics.map((m) => (
              <div key={m.label} className="flex items-center justify-between">
                <span className="text-sm">{m.label}</span>
                <StarRating value={m.value} readonly size="sm" />
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        {reportCard.notes && (
          <div>
            <h4 className="font-semibold mb-1">Observaciones</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{reportCard.notes}</p>
          </div>
        )}

        {reportCard.highlights && (
          <div>
            <h4 className="font-semibold mb-1">✨ Logros destacados</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{reportCard.highlights}</p>
          </div>
        )}

        {reportCard.areas_to_improve && (
          <div>
            <h4 className="font-semibold mb-1">📋 Áreas de mejora</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{reportCard.areas_to_improve}</p>
          </div>
        )}

        {/* Photos */}
        {reportCard.photos?.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Fotos</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {reportCard.photos.map((url: string, i: number) => (
                <img key={i} src={url} alt="" className="rounded-lg w-full aspect-square object-cover border" />
              ))}
            </div>
          </div>
        )}

        {/* Progress chart */}
        {chartData.length > 1 && (
          <div>
            <h4 className="font-semibold mb-2">Progreso del perro</h4>
            <div className="h-48 bg-muted/30 rounded-lg p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="general" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="energía" stroke="hsl(var(--info))" strokeWidth={1.5} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="social" stroke="hsl(var(--success))" strokeWidth={1.5} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="obediencia" stroke="hsl(var(--status-ready))" strokeWidth={1.5} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
