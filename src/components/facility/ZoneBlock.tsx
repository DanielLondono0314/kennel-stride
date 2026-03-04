import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { X, GripVertical, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KennelGrid } from "./KennelGrid";
import { ZONE_TYPES } from "./FacilityToolbar";

interface FacilityUnit {
  id: string;
  name: string;
  status: string;
  assigned_dog_name: string | null;
  assignment_end: string | null;
}

interface ZoneData {
  id: string;
  name: string;
  zone_type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  capacity: number;
}

interface ZoneBlockProps {
  zone: ZoneData;
  units: FacilityUnit[];
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onUnitClick: (unit: any) => void;
}

export function ZoneBlock({ zone, units, onMove, onResize, onDelete, onRename, onUnitClick }: ZoneBlockProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(zone.name);
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });
  const resizeRef = useRef({ startX: 0, startY: 0, origW: 0, origH: 0 });

  const ztConfig = ZONE_TYPES.find((z) => z.type === zone.zone_type);
  const Icon = ztConfig?.icon;

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: zone.x, origY: zone.y };

    const handleMove = (ev: MouseEvent) => {
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      onMove(zone.id, Math.max(0, dragRef.current.origX + dx), Math.max(0, dragRef.current.origY + dy));
    };
    const handleUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [zone.id, zone.x, zone.y, onMove, isEditing]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: zone.width, origH: zone.height };

    const handleMove = (ev: MouseEvent) => {
      const dx = ev.clientX - resizeRef.current.startX;
      const dy = ev.clientY - resizeRef.current.startY;
      onResize(zone.id, Math.max(150, resizeRef.current.origW + dx), Math.max(100, resizeRef.current.origH + dy));
    };
    const handleUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [zone.id, zone.width, zone.height, onResize]);

  const handleSaveName = () => {
    onRename(zone.id, editName);
    setIsEditing(false);
  };

  const occupied = units.filter((u) => u.status === "occupied").length;

  return (
    <div
      className={cn(
        "absolute rounded-lg border-2 shadow-sm select-none transition-shadow",
        isDragging && "shadow-lg z-50",
        isResizing && "z-50"
      )}
      style={{
        left: zone.x,
        top: zone.y,
        width: zone.width,
        height: zone.height,
        backgroundColor: zone.color + "12",
        borderColor: zone.color + "40",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-1.5 px-2 py-1 cursor-grab active:cursor-grabbing rounded-t-md"
        style={{ backgroundColor: zone.color + "25" }}
        onMouseDown={handleDragStart}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: zone.color }} />}
        
        {isEditing ? (
          <form onSubmit={(e) => { e.preventDefault(); handleSaveName(); }} className="flex items-center gap-1 flex-1 min-w-0">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-5 text-xs px-1 py-0"
              autoFocus
              onBlur={handleSaveName}
            />
            <Check className="h-3 w-3 cursor-pointer text-muted-foreground" onClick={handleSaveName} />
          </form>
        ) : (
          <span className="text-xs font-semibold truncate flex-1 text-foreground">{zone.name}</span>
        )}

        <span className="text-[10px] text-muted-foreground shrink-0">{occupied}/{units.length}</span>

        <button
          onClick={(e) => { e.stopPropagation(); setIsEditing(true); setEditName(zone.name); }}
          className="p-0.5 rounded hover:bg-background/50"
        >
          <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(zone.id); }}
          className="p-0.5 rounded hover:bg-destructive/20"
        >
          <X className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
        </button>
      </div>

      {/* Content */}
      <div className="overflow-auto p-1" style={{ maxHeight: zone.height - 32 }}>
        {zone.zone_type === "kennels" ? (
          <KennelGrid units={units} onUnitClick={onUnitClick} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-[10px] text-muted-foreground capitalize">{ztConfig?.label}</p>
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        onMouseDown={handleResizeStart}
      >
        <svg className="w-3 h-3 text-muted-foreground/50 absolute bottom-0.5 right-0.5" viewBox="0 0 10 10">
          <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
