import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { FacilityToolbar, ZoneTypeConfig, ZONE_TYPES } from "@/components/facility/FacilityToolbar";
import { ZoneBlock } from "@/components/facility/ZoneBlock";
import { FacilitySummary } from "@/components/facility/FacilitySummary";
import { KennelAssignmentModal } from "@/components/facility/KennelAssignmentModal";
import { Map, Loader2 } from "lucide-react";

interface FacilityZone {
  id: string;
  name: string;
  zone_type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  capacity: number;
  is_active: boolean;
  sort_order: number;
}

interface FacilityUnit {
  id: string;
  zone_id: string;
  name: string;
  unit_type: string;
  position_index: number;
  status: string;
  assigned_dog_id: string | null;
  assigned_dog_name: string | null;
  assignment_start: string | null;
  assignment_end: string | null;
  notes: string | null;
}

export default function FacilityPage() {
  const { organization } = useOrganization();
  const [zones, setZones] = useState<FacilityZone[]>([]);
  const [units, setUnits] = useState<FacilityUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState<FacilityUnit | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [dogs, setDogs] = useState<Array<{ id: string; name: string }>>([]);
  const { toast } = useToast();

  // Load data
  const fetchData = useCallback(async () => {
    if (!organization) return;
    setLoading(true);
    const [zRes, uRes] = await Promise.all([
      supabase.from("facility_zones").select("*").eq("organization_id", organization!.id).order("sort_order"),
      supabase.from("facility_units").select("*").eq("organization_id", organization!.id).order("position_index"),
    ]);
    if (zRes.data) setZones(zRes.data);
    if (uRes.data) setUnits(uRes.data);

    // Fetch dogs for kennel assignment
    const { data: custData } = await supabase
      .from("customers")
      .select("id")
      .eq("organization_id", organization!.id);
    const custIds = (custData ?? []).map((c: { id: string }) => c.id);
    if (custIds.length > 0) {
      const { data: dogsData } = await supabase
        .from("dogs")
        .select("id, name")
        .in("customer_id", custIds)
        .order("name");
      if (dogsData) setDogs(dogsData as Array<{ id: string; name: string }>);
    }

    setLoading(false);
  }, [organization?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Add zone
  const handleAddZone = async (zt: ZoneTypeConfig) => {
    if (!organization) return;
    const count = zones.filter((z) => z.zone_type === zt.type).length;
    const newZone = {
      name: `${zt.label} ${String.fromCharCode(65 + count)}`,
      zone_type: zt.type,
      x: 50 + count * 30,
      y: 50 + count * 30,
      width: 280,
      height: 200,
      color: zt.color,
      capacity: zt.defaultCapacity,
      sort_order: zones.length,
      organization_id: organization!.id,
    };

    const { data, error } = await supabase.from("facility_zones").insert(newZone).select().single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }

    // Auto-create units for kennel zones
    if (zt.type === "kennels" && data) {
      const unitInserts = Array.from({ length: zt.defaultCapacity }, (_, i) => ({
        zone_id: data.id,
        name: `Perrera ${String(i + 1).padStart(2, "0")}`,
        unit_type: "kennel",
        position_index: i,
        status: "available",
        organization_id: organization!.id,
      }));
      const { error: unitsError } = await supabase.from("facility_units").insert(unitInserts);
      if (unitsError) { toast({ title: "Error al crear unidades", description: unitsError.message, variant: "destructive" }); }
    }

    fetchData();
    toast({ title: "Zona agregada", description: newZone.name });
  };

  // Move zone
  const handleMoveZone = useCallback(async (id: string, x: number, y: number) => {
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, x, y } : z)));
    await supabase.from("facility_zones").update({ x, y }).eq("id", id);
  }, []);

  // Resize zone
  const handleResizeZone = useCallback(async (id: string, width: number, height: number) => {
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, width, height } : z)));
    await supabase.from("facility_zones").update({ width, height }).eq("id", id);
  }, []);

  // Delete zone
  const handleDeleteZone = async (id: string) => {
    await supabase.from("facility_zones").delete().eq("id", id);
    fetchData();
    toast({ title: "Zona eliminada" });
  };

  // Rename zone
  const handleRenameZone = async (id: string, name: string) => {
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, name } : z)));
    await supabase.from("facility_zones").update({ name }).eq("id", id);
  };

  // Unit click
  const handleUnitClick = (unit: any) => {
    const fullUnit = units.find((u) => u.id === unit.id);
    if (fullUnit) {
      setSelectedUnit(fullUnit);
      setModalOpen(true);
    }
  };

  // Assign dog
  const handleAssign = async (unitId: string, data: any) => {
    const { error } = await supabase.from("facility_units").update(data).eq("id", unitId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setModalOpen(false);
    fetchData();
    toast({ title: "Perro asignado", description: `${data.assigned_dog_name} asignado correctamente` });
  };

  // Release unit
  const handleRelease = async (unitId: string) => {
    const { error } = await supabase.from("facility_units").update({
      status: "available",
      assigned_dog_id: null,
      assigned_dog_name: null,
      assignment_start: null,
      assignment_end: null,
      notes: "",
    }).eq("id", unitId);
    if (error) { toast({ title: "Error al liberar perrera", description: error.message, variant: "destructive" }); return; }
    setModalOpen(false);
    fetchData();
    toast({ title: "Perrera liberada" });
  };

  // Add a single kennel unit to an existing zone
  const handleAddUnit = async (zoneId: string) => {
    if (!organization) return;
    const zoneUnits = units.filter((u) => u.zone_id === zoneId);
    const nextIndex = zoneUnits.length;
    const nextName = `Perrera ${String(nextIndex + 1).padStart(2, "0")}`;
    const { error } = await supabase.from("facility_units").insert({
      zone_id: zoneId,
      name: nextName,
      unit_type: "kennel",
      position_index: nextIndex,
      status: "available",
      organization_id: organization!.id,
    });
    if (error) {
      toast({ title: "Error al agregar perrera", description: error.message, variant: "destructive" });
      return;
    }
    fetchData();
    toast({ title: "Perrera agregada", description: nextName });
  };

  // Set maintenance
  const handleSetMaintenance = async (unitId: string) => {
    const { error } = await supabase.from("facility_units").update({
      status: "maintenance",
      assigned_dog_id: null,
      assigned_dog_name: null,
      assignment_start: null,
      assignment_end: null,
    }).eq("id", unitId);
    if (error) { toast({ title: "Error al cambiar estado", description: error.message, variant: "destructive" }); return; }
    setModalOpen(false);
    fetchData();
    toast({ title: "Perrera en mantenimiento" });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b bg-card">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
          <Map className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Mapa de Instalaciones</h1>
          <p className="text-xs text-muted-foreground">Diseña y gestiona las zonas de tu centro canino</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Toolbar */}
        <FacilityToolbar onAddZone={handleAddZone} />

        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-muted/30 relative" style={{ minHeight: 600 }}>
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : zones.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-2">
                <Map className="h-12 w-12 mx-auto text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Agrega zonas desde el panel izquierdo para comenzar
                </p>
              </div>
            </div>
          )}

          <div className="relative" style={{ minWidth: 1200, minHeight: 800 }}>
            {zones.map((zone) => (
              <ZoneBlock
                key={zone.id}
                zone={zone}
                units={units.filter((u) => u.zone_id === zone.id)}
                onMove={handleMoveZone}
                onResize={handleResizeZone}
                onDelete={handleDeleteZone}
                onRename={handleRenameZone}
                onUnitClick={handleUnitClick}
                onAddUnit={handleAddUnit}
              />
            ))}
          </div>
        </div>

        {/* Summary */}
        <FacilitySummary zones={zones} units={units} />
      </div>

      {/* Assignment Modal */}
      <KennelAssignmentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        unit={selectedUnit}
        dogs={dogs}
        onAssign={handleAssign}
        onRelease={handleRelease}
        onSetMaintenance={handleSetMaintenance}
      />
    </div>
  );
}
