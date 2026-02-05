import { cn } from "@/lib/utils";

export type OpsTab = "notices" | "expected" | "going-home" | "checked-in" | "requested";

interface OpsTabsProps {
  activeTab: OpsTab;
  onTabChange: (tab: OpsTab) => void;
  counts: {
    notices: number;
    expected: number;
    goingHome: number;
    checkedIn: number;
    requested: number;
  };
}

const tabs: { id: OpsTab; label: string; countKey: keyof OpsTabsProps["counts"] }[] = [
  { id: "notices", label: "Avisos", countKey: "notices" },
  { id: "expected", label: "Esperados Hoy", countKey: "expected" },
  { id: "going-home", label: "Salen Hoy", countKey: "goingHome" },
  { id: "checked-in", label: "Registrados", countKey: "checkedIn" },
  { id: "requested", label: "Solicitudes", countKey: "requested" },
];

export function OpsTabs({ activeTab, onTabChange, counts }: OpsTabsProps) {
  return (
    <div className="ops-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "ops-tab flex items-center gap-2",
            activeTab === tab.id && "ops-tab-active"
          )}
        >
          <span>{tab.label}</span>
          <span
            className={cn(
              "flex h-5 min-w-5 items-center justify-center rounded-full text-xs font-medium px-1.5",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted-foreground/20 text-muted-foreground"
            )}
          >
            {counts[tab.countKey]}
          </span>
        </button>
      ))}
    </div>
  );
}
