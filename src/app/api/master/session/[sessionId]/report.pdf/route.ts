import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildSessionReportPdf } from "@/lib/pdf/session-report-pdf";
import { getLatestSessionSummary, getSessionTimeline } from "@/server/repositories/session-history-repository";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try { const { sessionId }=await context.params; const supabase=await createClient(); const {data,error}=await supabase.from("sessions").select("campaign_id,title,campaigns(name)").eq("id",sessionId).single(); if(error) throw new Error(error.message); await requireCampaignMaster(data.campaign_id); const summary=await getLatestSessionSummary(sessionId); if(!summary) throw new Error("Gere e salve o resumo antes de exportar o PDF."); const timeline=await getSessionTimeline(data.campaign_id,sessionId,250); let logo:Uint8Array|undefined; try{logo=new Uint8Array(await readFile(path.join(process.cwd(),"public","zona-7-convergencia-logo.png")));}catch{} const bytes=await buildSessionReportPdf({campaignName:(data.campaigns as unknown as {name:string})?.name??"Zona 7",sessionTitle:data.title,summary,timeline,logo}); const download=new URL(request.url).searchParams.get("download")==="1"; return new Response(new Uint8Array(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":`${download?"attachment":"inline"}; filename="relatorio-sessao-zona-7.pdf"`,"Cache-Control":"private, no-store"}}); } catch(error){return Response.json({error:error instanceof Error?error.message:"Falha ao gerar PDF."},{status:400});}
}
