import { NewCampaignForm } from "@/components/master/new-campaign-form";
import { getPerfisDeRegras } from "@/server/repositories/master-repository";

export default async function NewCampaignPage() {
  const profiles = await getPerfisDeRegras();
  return (
    <div className="mx-auto max-w-3xl">
      <p className="eyebrow">configuração inicial</p>
      <h1 className="mt-1 text-3xl font-black">Nova campanha</h1>
      <p className="mt-2 text-sm text-[#8f9299]">
        A campanha será criada no servidor e você será registrado como responsável.
      </p>
      <NewCampaignForm profiles={profiles} />
    </div>
  );
}
