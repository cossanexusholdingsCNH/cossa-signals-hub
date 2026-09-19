import { supabaseAdmin } from "../../integrations/supabase/client.server";

function holderId(jobKey: string) {
  return `${jobKey}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function acquireSchedulerLease(jobKey: string, leaseSeconds: number) {
  const holder = holderId(jobKey);
  const { data, error } = await supabaseAdmin.rpc("acquire_scheduler_lease", {
    p_job_key: jobKey,
    p_holder: holder,
    p_lease_seconds: leaseSeconds,
  });
  if (error) throw new Error(`Unable to acquire ${jobKey} scheduler lease: ${error.message}`);
  return { acquired: Boolean(data), holder };
}

export async function releaseSchedulerLease(jobKey: string, holder: string) {
  const { error } = await supabaseAdmin.rpc("release_scheduler_lease", {
    p_job_key: jobKey,
    p_holder: holder,
  });
  if (error) console.error(`Unable to release ${jobKey} scheduler lease`, error);
}
