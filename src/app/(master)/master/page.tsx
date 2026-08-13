import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  Dices,
  Eye,
  HeartPulse,
  Map,
  MessageSquare,
  Plus,
  Radio,
  ScrollText,
  Sparkles,
  Swords,
  Users,
} from "lucide-react";
import { CharacterPortrait } from "@/components/character/character-portrait";
import { ResourceBars } from "@/components/character/resource-bars";
import { getCampaignCharacters } from "@/server/repositories/character-repository";
import {
  getCampanhasDoMestre,
  getEventosAuditoria,
} from "@/server/repositories/master-repository";

const eventLabels: Record<string, string> = {
  resource_changed: "Recurso de personagem atualizado",
  message_sent: "Mensagem enviada",
  ability_released: "Habilidade liberada",
  ability_use_requested: "Uso de habilidade solicitado",
  ability_use_approved: "Uso de habilidade aprovado",
  ability_use_rejected: "Uso de habilidade recusado",
  dice_rolled: "Rolagem pública registrada",
  scene_published: "Cena publicada para os jogadores",
  combat_turn_advanced: "Turno de combate avançado",
  item_delivered: "Item entregue",
  handout_delivered: "Pista revelada",
};

function relativeDate(date: string) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "agora";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function MasterHomePage() {
  const campanhas = await getCampanhasDoMestre();
  const principal = campanhas[0];
  const [characters, audit] = principal
    ? await Promise.all([
        getCampaignCharacters(principal.id),
        getEventosAuditoria(principal.id),
      ])
    : [[], []];

  if (!principal) {
    return (
      <div className="master-dashboard">
        <section className="panel master-empty-state">
          <div className="master-empty-logo">
            <Image src="/zona-7-convergencia-logo.png" alt="Zona 7" fill sizes="300px" />
          </div>
          <p className="eyebrow">console do mestre</p>
          <h1>Nenhuma campanha cadastrada</h1>
          <p>Crie a campanha para começar a configurar regras, personagens, mapa e sessão.</p>
          <Link href="/master/campaigns/new" className="btn btn-primary">
            <Plus size={16} /> Criar primeira campanha
          </Link>
        </section>
      </div>
    );
  }

  const campaign = `/master/campaigns/${principal.id}`;
  const liveHref = principal.sessao
    ? `${campaign}/sessions/${principal.sessao.id}`
    : `${campaign}/sessions`;
  const statusLabel = principal.sessao?.estado === "active" ? "Ao vivo" : principal.situacao;
  const pressurePercent = Math.max(0, Math.min(100, (principal.pressao / 7) * 100));
  const quickActions = [
    ["Aplicar dano", `${campaign}/characters`, HeartPulse, "danger"],
    ["Solicitar teste", liveHref, Dices, "violet"],
    ["Enviar mensagem", `${campaign}/messages`, MessageSquare, "blue"],
    ["Revelar habilidade", `${campaign}/characters`, Eye, "violet"],
    ["Iniciar combate", `${campaign}/encounters`, Swords, "danger"],
    ["Abrir mapa", `${campaign}/maps`, Map, "orange"],
  ] as const;

  return (
    <div className="master-dashboard">
      <header className="master-dashboard-heading">
        <div>
          <p className="eyebrow">visão operacional</p>
          <h1>Boa noite, Mestre.</h1>
          <p>Tudo pronto para continuar <strong>{principal.nome}</strong>.</p>
        </div>
        <Link href="/master/campaigns/new" className="btn">
          <Plus size={15} /> Nova campanha
        </Link>
      </header>

      <div className="master-dashboard-grid">
        <main className="master-dashboard-main">
          <section className="panel campaign-hero-card">
            <div className="campaign-hero-art" aria-hidden="true">
              <Image src="/zona-7-convergencia-logo.png" alt="" fill sizes="320px" priority />
            </div>
            <div className="campaign-hero-copy">
              <p className="eyebrow">campanha principal</p>
              <h2>{principal.sessao?.titulo ?? principal.nome}</h2>
              <div className="campaign-hero-status">
                <span className="tag"><span className="status-dot" /> {statusLabel}</span>
                <span><Users size={14} /> {principal.conectados}/{principal.personagens} conectados</span>
              </div>
              <div className="campaign-operational-stats">
                <div>
                  <span>Pressão narrativa</span>
                  <strong>{principal.pressao}/7</strong>
                </div>
                <div>
                  <span>Cena atual</span>
                  <strong>{principal.sessao?.cena ?? "Aguardando sessão"}</strong>
                </div>
                <div>
                  <span>Elenco</span>
                  <strong>{principal.personagens} personagens</strong>
                </div>
              </div>
              <div className="campaign-hero-actions">
                <Link href={liveHref} className="btn btn-primary">
                  <Radio size={16} /> {principal.sessao ? "Abrir central da sessão" : "Preparar sessão"}
                </Link>
                <Link href={campaign} className="btn">
                  Abrir campanha <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </section>

          <section className="dashboard-section">
            <div className="dashboard-section-heading">
              <div><Users size={18} /><h2>Estado do grupo</h2></div>
              <Link href={`${campaign}/characters`}>Ver personagens <ArrowRight size={14} /></Link>
            </div>
            <div className="master-character-grid">
              {characters.slice(0, 6).map((character) => (
                <Link
                  className="panel master-character-card"
                  href={`${campaign}/characters/${character.id}`}
                  key={character.id}
                >
                  <div className="master-character-header">
                    <CharacterPortrait
                      name={character.name}
                      portraitUrl={character.portraitUrl}
                      className="size-11 rounded-full"
                    />
                    <span>
                      <strong>{character.name}</strong>
                      <small>{character.path} · NEX {character.nex}%</small>
                    </span>
                  </div>
                  <ResourceBars resources={character.resources} compact />
                  <div className="master-character-footer">
                    <span>DEF {character.defense}</span>
                    <span>{character.status}</span>
                  </div>
                </Link>
              ))}
              {characters.length === 0 && (
                <div className="panel dashboard-empty-row">Nenhum personagem cadastrado nesta campanha.</div>
              )}
            </div>
          </section>

          <div className="master-dashboard-lower-grid">
            <section className="panel dashboard-activity-card">
              <div className="dashboard-section-heading compact">
                <div><Clock3 size={18} /><h2>Atividade recente</h2></div>
                <Link href={`${campaign}/audit`}>Auditoria</Link>
              </div>
              <div className="dashboard-activity-list">
                {audit.slice(0, 5).map((event) => (
                  <Link href={`${campaign}/audit`} key={event.id}>
                    <span className="activity-icon"><Sparkles size={15} /></span>
                    <span>
                      <strong>{eventLabels[event.tipo] ?? event.tipo.replaceAll("_", " ")}</strong>
                      <small>{event.entidade}</small>
                    </span>
                    <time>{relativeDate(event.criadoEm)}</time>
                  </Link>
                ))}
                {audit.length === 0 && <p className="dashboard-empty-row">A atividade aparecerá após as primeiras ações.</p>}
              </div>
            </section>

            <section className="panel dashboard-prep-card">
              <div className="dashboard-section-heading compact">
                <div><ScrollText size={18} /><h2>Preparação da sessão</h2></div>
              </div>
              <Link href={`${campaign}/scripts`}><span>Revisar roteiro publicado</span><ArrowRight size={15} /></Link>
              <Link href={`${campaign}/maps`}><span>Conferir mapa e tokens</span><ArrowRight size={15} /></Link>
              <Link href={`${campaign}/actors`}><span>Preparar entidades e NPCs</span><ArrowRight size={15} /></Link>
              <Link href={`/master/help?campaignId=${principal.id}`}><span>Consultar regras e ajuda</span><ArrowRight size={15} /></Link>
            </section>
          </div>
        </main>

        <aside className="master-dashboard-side">
          <section className="panel quick-actions-card">
            <div className="dashboard-section-heading compact"><div><Sparkles size={18} /><h2>Ações rápidas</h2></div></div>
            <div className="quick-actions-grid">
              {quickActions.map(([label, href, Icon, tone]) => (
                <Link href={href} key={label} data-tone={tone}>
                  <Icon size={22} /><span>{label}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="panel pressure-card">
            <div className="dashboard-section-heading compact"><div><Radio size={18} /><h2>Pressão da Zona</h2></div></div>
            <strong>{principal.pressao} / 7</strong>
            <div className="pressure-track" aria-label={`Pressão ${principal.pressao} de 7`}>
              <i style={{ width: `${pressurePercent}%` }} />
            </div>
            <p>{principal.pressao < 3 ? "Controlada" : principal.pressao < 5 ? "Instável" : principal.pressao < 7 ? "Crítica" : "Limite"}</p>
            <Link className="btn w-full" href={`${campaign}/settings`}>Ajustar regras</Link>
          </section>

          {campanhas.length > 1 && (
            <section className="panel other-campaigns-card">
              <h2>Outras campanhas</h2>
              {campanhas.slice(1).map((item) => (
                <Link href={`/master/campaigns/${item.id}`} key={item.id}>
                  <span><strong>{item.nome}</strong><small>{item.situacao}</small></span>
                  <ArrowRight size={14} />
                </Link>
              ))}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
