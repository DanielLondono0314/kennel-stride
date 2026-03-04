import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FacilityToolbar, ZoneTypeConfig, ZONE_TYPES } from "@/components/facility/FacilityToolbar";
import { ZoneBlock } from "@/components/facility/ZoneBlock";
import { FacilitySummary } from "@/components/facility/FacilitySummary";
import { KennelAssignmentModal } from "@/components/facility/KennelAssignmentModal";
import { Map } from "lucide-react";

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
  const [zones, setZones] = useState<FacilityZone[]>([]);
  const [units, setUnits] = useState<FacilityUnit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<FacilityUnit | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { toast } = useToast();

  // Load data
  const fetchData = useCallback(async () => {
    const [zRes, uRes] = await Promise.all([
      supabase.from("facility_zones").select("*").order("sort_order"),
      supabase.from("facility_units").select("*").order("position_index"),
    ]);
    if (zRes.data) setZones(zRes.data);
    if (uRes.data) setUnits(uRes.data);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Add zone
  const handleAddZone = async (zt: ZoneTypeConfig) => {
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
      }));
      await supabase.from("facility_units").insert(unitInserts);
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
    await supabase.from("facility_units").update({
      status: "available",
      assigned_dog_id: null,
      assigned_dog_name: null,
      assignment_start: null,
      assignment_end: null,
      notes: "",
    }).eq("id", unitId);
    setModalOpen(false);
    fetchData();
    toast({ title: "Perrera liberada" });
  };

  // Set maintenance
  const handleSetMaintenance = async (unitId: string) => {
    await supabase.from("facility_units").update({
      status: "maintenance",
      assigned_dog_id: null,
      assigned_dog_name: null,
      assignment_start: null,
      assignment_end: null,
    }).eq("id", unitId);
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

          {zones.length === 0 && (
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
        onAssign={handleAssign}
        onRelease={handleRelease}
        onSetMaintenance={handleSetMaintenance}
      />
    </div>
  );
}
