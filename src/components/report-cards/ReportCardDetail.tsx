import { useCallback, useEffect, useState } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StarRating } from "./StarRating";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Dog, PawPrint, Pencil, Send, Loader2 } from "lucide-react";
import { parseDateOnly } from "@/lib/age";
import { useServiceTypes } from "@/hooks/useServiceTypes";
import {
  CATEGORY_CONFIG,
  isServiceCategory,
  readDetails,
  readMetrics,
  type ServiceCategory,
} from "@/lib/reportCardServices";

interface ReportCardDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportCard: any;
  staffName?: string;
  onEdit?: () => void;
  onSend?: () => void | Promise<void>;
  sending?: boolean;
}

export function ReportCardDetail({ open, onOpenChange, reportCard, staffName, onEdit, onSend, sending }: ReportCardDetailProps) {
  const { organization } = useOrganization();
  const { labels: serviceLabels, categoryFor } = useServiceTypes();
  const [history, setHistory] = useState<{ session_date: string; overall_score: number }[]>([]);
  const [dogInfo, setDogInfo] = useState<{ breed: string; weight: number | null; gender: string; customer_name: string } | null>(null);

  const orgId = organization?.id;
  const category: ServiceCategory | null = reportCard
    ? isServiceCategory(reportCard.service_category) ? reportCard.service_category : categoryFor(reportCard.service_type)
    : null;

  // Progreso dentro del mismo tipo de servicio: comparar un baño con una
  // sesión de entrenamiento no dice nada.
  const loadHistory = useCallback(async (dogId: string, cat: ServiceCategory) => {
    if (!orgId) return;
    const { data } = await supabase
      .from("report_cards")
      .select("session_date, overall_score")
      .eq("dog_id", dogId)
      .eq("organization_id", orgId)
      .eq("service_category", cat)
      .order("session_date", { ascending: false })
      .limit(10);
    if (data) setHistory([...data].reverse());
  }, [orgId]);

  useEffect(() => {
    if (!open || !reportCard?.dog_id || !orgId || !category) return;
    loadHistory(reportCard.dog_id, category);
    supabase
      .from("dogs")
      .select("breed, weight, gender, customers(first_name, last_name)")
      .eq("id", reportCard.dog_id)
      .eq("organization_id", orgId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const owner = data.customers;
          setDogInfo({
            breed: data.breed,
            weight: data.weight,
            gender: data.gender,
            customer_name: owner ? `${owner.first_name} ${owner.last_name}` : "",
          });
        }
      });
  }, [open, reportCard?.dog_id, orgId, category, loadHistory]);

  if (!reportCard || !category) return null;

  const cfg = CATEGORY_CONFIG[category];
  const details = readDetails(reportCard.details);
  const metrics = readMetrics(reportCard);
  const serviceLabel = serviceLabels[reportCard.service_type] ?? details.service_label ?? reportCard.service_type;

  const chartData = history.map((h) => ({
    date: format(parseDateOnly(h.session_date), "dd/MM"),
    general: h.overall_score,
  }));

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
            {dogInfo && (
              <p className="text-sm text-muted-foreground">
                {dogInfo.breed}{dogInfo.weight ? ` · ${dogInfo.weight}kg` : ""} · {dogInfo.gender === "male" ? "Macho" : "Hembra"}
              </p>
            )}
            {dogInfo?.customer_name && (
              <p className="text-sm text-muted-foreground">Dueño: {dogInfo.customer_name}</p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline">{cfg.icon} {serviceLabel}</Badge>
              <Badge variant={reportCard.is_sent ? "default" : "secondary"}>
                {reportCard.is_sent ? "Enviado" : "Borrador"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {format(parseDateOnly(reportCard.session_date), "PPP", { locale: es })}
              </span>
            </div>
          </div>
        </div>

        {staffName && (
          <p className="text-sm text-muted-foreground">
            {details.staff_label ?? cfg.staffLabel}: <span className="font-medium text-foreground">{staffName}</span>
          </p>
        )}

        {/* Detalle propio del servicio */}
        {details.summary && details.summary.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold">Detalle de {cfg.label.toLowerCase()}</h4>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 bg-muted/30 rounded-lg p-3">
              {details.summary.map((s) => (
                <div key={s.label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{s.label}</dt>
                  <dd className="text-sm whitespace-pre-wrap break-words">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Metrics */}
        <div className="space-y-2">
          <h4 className="font-semibold">¿Cómo estuvo?</h4>
          <div className="grid gap-2 bg-muted/30 rounded-lg p-3">
            {metrics.map((m) => (
              <div key={m.label} className="flex items-center justify-between gap-3">
                <span className="text-sm">{m.label}</span>
                <StarRating value={m.value} readonly size="sm" />
              </div>
            ))}
          </div>
        </div>

        {reportCard.notes && (
          <div>
            <h4 className="font-semibold mb-1">Observaciones</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{reportCard.notes}</p>
          </div>
        )}

        {reportCard.highlights && (
          <div>
            <h4 className="font-semibold mb-1">✨ {cfg.highlightsLabel}</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{reportCard.highlights}</p>
          </div>
        )}

        {reportCard.areas_to_improve && (
          <div>
            <h4 className="font-semibold mb-1">📋 {cfg.improveLabel}</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{reportCard.areas_to_improve}</p>
          </div>
        )}

        {reportCard.photos?.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">{cfg.photosLabel}</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {reportCard.photos.map((url: string, i: number) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt={`Foto ${i + 1} de ${reportCard.dog_name}`} width={200} height={200} loading="lazy" className="rounded-lg w-full aspect-square object-cover border" />
                </a>
              ))}
            </div>
          </div>
        )}

        {chartData.length > 1 && (
          <div>
            <h4 className="font-semibold mb-2">Progreso en {cfg.label.toLowerCase()}</h4>
            <div className="h-48 bg-muted/30 rounded-lg p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="general" name="Puntuación general" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          {onEdit && (
            <Button variant="outline" onClick={onEdit} className="gap-1.5">
              <Pencil className="h-4 w-4" />Editar
            </Button>
          )}
          {onSend && (
            <Button onClick={onSend} disabled={sending} className="gap-1.5">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {reportCard.is_sent ? "Reenviar al dueño" : "Enviar al dueño"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
