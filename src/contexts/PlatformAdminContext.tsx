import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export type PlatformAdminRole = "owner" | "support_readonly";

interface PlatformAdminContextType {
  loading: boolean;
  isPlatformAdmin: boolean;
  platformRole: PlatformAdminRole | null;
  /** Escritura solo permitida a 'owner'; support_readonly es solo lectura. */
  canWrite: boolean;
  refetch: () => void;
}

const PlatformAdminContext = createContext<PlatformAdminContextType>({
  loading: true,
  isPlatformAdmin: false,
  platformRole: null,
  canWrite: false,
  refetch: () => {},
});

export function PlatformAdminProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [platformRole, setPlatformRole] = useState<PlatformAdminRole | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setPlatformRole(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("get_platform_admin_role");
    setPlatformRole(!error && data ? (data as PlatformAdminRole) : null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const isPlatformAdmin = platformRole !== null;

  return (
    <PlatformAdminContext.Provider
      value={{
        loading,
        isPlatformAdmin,
        platformRole,
        canWrite: platformRole === "owner",
        refetch: load,
      }}
    >
      {children}
    </PlatformAdminContext.Provider>
  );
}

export const usePlatformAdmin = () => useContext(PlatformAdminContext);
