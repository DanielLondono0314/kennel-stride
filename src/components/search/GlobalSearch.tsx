import { useState, useEffect, useCallback, useRef } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrgNavigate } from "@/hooks/useOrgNavigate";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Users, Dog, CalendarDays, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  category: "customers" | "dogs" | "reservations";
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_LABELS: Record<string, string> = {
  requested: "Solicitada",
  scheduled: "Programada",
  checked_in: "En el centro",
  completed: "Completada",
  cancelled: "Cancelada",
};

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const { organization } = useOrganization();
  const orgNavigate = useOrgNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    if (!organization) return;

    setLoading(true);
    const pattern = `%${q.trim()}%`;

    const [custRes, dogsRes, resRes] = await Promise.all([
      supabase
        .from("customers")
        .select("id, first_name, last_name, email, phone")
        .eq("organization_id", organization!.id)
        .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
        .limit(5),
      supabase
        .from("dogs")
        .select("id, name, breed, customers(first_name, last_name)")
        .eq("organization_id", organization!.id)
        .or(`name.ilike.${pattern},breed.ilike.${pattern}`)
        .limit(5),
      supabase
        .from("reservations")
        .select("id, service_name, status, start_date, dogs(name), customers(first_name, last_name)")
        .eq("organization_id", organization!.id)
        .or(`service_name.ilike.${pattern}`)
        .order("start_date", { ascending: false })
        .limit(5),
    ]);

    const mapped: SearchResult[] = [];

    for (const c of custRes.data || []) {
      mapped.push({
        id: c.id,
        category: "customers",
        label: `${c.first_name} ${c.last_name}`,
        sublabel: c.email || c.phone || undefined,
        href: `/customers/${c.id}`,
      });
    }

    for (const d of dogsRes.data || []) {
      const owner = d.customers;
      mapped.push({
        id: d.id,
        category: "dogs",
        label: d.name,
        sublabel: `${d.breed}${owner ? ` · ${owner.first_name} ${owner.last_name}` : ""}`,
        href: `/dogs/${d.id}`,
      });
    }

    for (const r of resRes.data || []) {
      const dog = r.dogs;
      const customer = r.customers;
      mapped.push({
        id: r.id,
        category: "reservations",
        label: `${r.service_name}${dog ? ` — ${dog.name}` : ""}`,
        sublabel: `${STATUS_LABELS[r.status] || r.status} · ${format(new Date(r.start_date), "d MMM yyyy", { locale: es })}${customer ? ` · ${customer.first_name} ${customer.last_name}` : ""}`,
        href: `/requests`,
      });
    }

    setResults(mapped);
    setLoading(false);
  }, [organization?.id]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const handleSelect = (href: string) => {
    orgNavigate(href);
    onOpenChange(false);
  };

  const customers = results.filter((r) => r.category === "customers");
  const dogs = results.filter((r) => r.category === "dogs");
  const reservations = results.filter((r) => r.category === "reservations");
  const hasResults = results.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar clientes, perros, reservas..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[400px]">
        {loading && (
          <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Buscando...</span>
          </div>
        )}

        {!loading && query.length >= 2 && !hasResults && (
          <CommandEmpty>Sin resultados para "{query}"</CommandEmpty>
        )}

        {!loading && query.length < 2 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Escribe al menos 2 caracteres para buscar
          </div>
        )}

        {!loading && customers.length > 0 && (
          <CommandGroup heading="Clientes">
            {customers.map((r) => (
              <CommandItem
                key={r.id}
                value={`customer-${r.id}-${r.label}`}
                onSelect={() => handleSelect(r.href)}
                className="gap-3 cursor-pointer"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 shrink-0">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.label}</p>
                  {r.sublabel && <p className="text-xs text-muted-foreground truncate">{r.sublabel}</p>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!loading && customers.length > 0 && dogs.length > 0 && <CommandSeparator />}

        {!loading && dogs.length > 0 && (
          <CommandGroup heading="Perros">
            {dogs.map((r) => (
              <CommandItem
                key={r.id}
                value={`dog-${r.id}-${r.label}`}
                onSelect={() => handleSelect(r.href)}
                className="gap-3 cursor-pointer"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/20 shrink-0">
                  <Dog className="h-4 w-4 text-accent-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.label}</p>
                  {r.sublabel && <p className="text-xs text-muted-foreground truncate">{r.sublabel}</p>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!loading && dogs.length > 0 && reservations.length > 0 && <CommandSeparator />}

        {!loading && reservations.length > 0 && (
          <CommandGroup heading="Reservas">
            {reservations.map((r) => (
              <CommandItem
                key={r.id}
                value={`reservation-${r.id}-${r.label}`}
                onSelect={() => handleSelect(r.href)}
                className="gap-3 cursor-pointer"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-success/10 shrink-0">
                  <CalendarDays className="h-4 w-4 text-success" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.label}</p>
                  {r.sublabel && <p className="text-xs text-muted-foreground truncate">{r.sublabel}</p>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
