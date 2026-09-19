import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { RankedOpportunity, ScannerSettings } from "@/lib/opportunity-scanner";

export type ScannerResponse = {
  ok: boolean;
  error?: string;
  generatedAt?: string;
  settings?: ScannerSettings;
  summary?: { total: number; qualified: number; rejected: number };
  opportunities?: RankedOpportunity[];
};

export function useOpportunityScanner(refetchInterval = 30_000) {
  return useQuery({
    queryKey: ["opportunity-scanner"],
    refetchInterval,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Authentication required");
      const response = await fetch("/api/opportunity-scanner", {
        headers: { authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as ScannerResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Opportunity scanner failed");
      }
      return payload;
    },
  });
}
