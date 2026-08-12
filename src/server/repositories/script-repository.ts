import "server-only";

import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export type SessionScriptRun = {
  runId: string;
  status: string;
  sequence: number;
  node: {
    key: string;
    title: string;
    type: string;
    text: string;
  } | null;
  options: Array<{ key: string; label: string; type: string }>;
};

export async function getScriptRunSnapshot(runId: string): Promise<SessionScriptRun | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data: run, error: runError } = await supabase
    .from("script_runs")
    .select("id,status,sequence_number,current_node_id")
    .eq("id", runId)
    .maybeSingle();
  if (runError) throw new Error(`Falha ao carregar execução do roteiro: ${runError.message}`);
  if (!run) return null;
  if (!run.current_node_id)
    return { runId: run.id, status: run.status, sequence: Number(run.sequence_number), node: null, options: [] };

  const [nodeResult, edgeResult] = await Promise.all([
    supabase
      .from("script_nodes")
      .select("stable_key,title,node_type,public_content")
      .eq("id", run.current_node_id)
      .single(),
    supabase
      .from("script_edges")
      .select("target_node_id,edge_type,label,sort_order")
      .eq("source_node_id", run.current_node_id)
      .order("sort_order"),
  ]);
  if (nodeResult.error) throw new Error(`Falha ao carregar nó do roteiro: ${nodeResult.error.message}`);
  if (edgeResult.error) throw new Error(`Falha ao carregar caminhos do roteiro: ${edgeResult.error.message}`);
  const targetIds = edgeResult.data.map((edge) => edge.target_node_id);
  const targets = targetIds.length
    ? await supabase.from("script_nodes").select("id,stable_key,title").in("id", targetIds)
    : { data: [], error: null };
  if (targets.error) throw new Error(`Falha ao carregar destinos do roteiro: ${targets.error.message}`);
  const content = nodeResult.data.public_content as Record<string, unknown>;
  return {
    runId: run.id,
    status: run.status,
    sequence: Number(run.sequence_number),
    node: {
      key: nodeResult.data.stable_key,
      title: nodeResult.data.title,
      type: nodeResult.data.node_type,
      text: String(content.text ?? content.prompt ?? "Nó sem texto público."),
    },
    options: edgeResult.data.flatMap((edge) => {
      const target = targets.data?.find((item) => item.id === edge.target_node_id);
      return target
        ? [{ key: target.stable_key, label: edge.label ?? target.title, type: edge.edge_type }]
        : [];
    }),
  };
}

export async function getSessionScriptRun(sessionId: string): Promise<SessionScriptRun | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("live_sessions")
    .select("current_script_run_id")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao localizar roteiro da sessão: ${error.message}`);
  return data?.current_script_run_id ? getScriptRunSnapshot(data.current_script_run_id) : null;
}
