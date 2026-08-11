"use client";

import { useState } from "react";
import {
  Eye,
  LayoutGrid,
  Palette,
  Plus,
  Save,
  Settings2,
  SlidersHorizontal,
  Type,
} from "lucide-react";
import type {
  CampoPersonalizado,
  PersonalizacaoCampanha,
} from "@/server/repositories/master-repository";

const nomesModulos: Record<string, string> = {
  combate: "Combate e iniciativa",
  mensagens: "Mensagens secretas",
  pistas: "Pistas e documentos",
  dados: "Rolagens de dados",
  auditoria: "Histórico e auditoria",
  sons: "Sons e efeitos",
  notificacoes: "Notificações",
  animacoes: "Animações da interface",
};
const entidades = [
  ["character", "Personagem"],
  ["ability", "Habilidade"],
  ["item", "Item"],
  ["session", "Sessão"],
  ["encounter", "Encontro"],
  ["message", "Mensagem"],
  ["handout", "Pista"],
];
const tiposCampo = [
  ["text", "Texto curto"],
  ["textarea", "Texto longo"],
  ["number", "Número"],
  ["boolean", "Sim ou não"],
  ["select", "Lista de opções"],
  ["date", "Data"],
  ["color", "Cor"],
];

export function CustomizationManager({
  campaignId,
  initial,
}: {
  campaignId: string;
  initial: PersonalizacaoCampanha;
}) {
  const [dados, setDados] = useState(initial);
  const [aviso, setAviso] = useState("");
  const [campo, setCampo] = useState({
    entidade: "character",
    chave: "",
    rotulo: "",
    tipo: "text",
    visibilidade: "campaign",
  });

  function atualizarModulo(chave: string, ativo: boolean) {
    setDados((atual) => ({ ...atual, modulos: { ...atual.modulos, [chave]: ativo } }));
  }

  async function salvar() {
    setAviso("");
    const response = await fetch("/api/master/customization", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        action: "settings",
        name: dados.nome,
        timezone: dados.fusoHorario,
        labels: dados.rotulos,
        theme: {
          accent: dados.tema.destaque,
          energy: dados.tema.energia,
          background: dados.tema.fundo,
        },
        featureFlags: dados.modulos,
        rules: {
          zeroHp: dados.regras.zeroPv,
          zeroSan: dados.regras.zeroSan,
          pressure: dados.regras.pressao,
        },
      }),
    });
    const result = (await response.json()) as { error?: string };
    setAviso(
      response.ok
        ? "Todas as configurações foram salvas."
        : (result.error ?? "Falha ao salvar configurações."),
    );
  }

  async function adicionarCampo(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/master/customization", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        action: "field",
        entityType: campo.entidade,
        fieldKey: campo.chave,
        label: campo.rotulo,
        inputType: campo.tipo,
        visibility: campo.visibilidade,
      }),
    });
    const result = (await response.json()) as { id?: string; error?: string };
    if (!response.ok) return setAviso(result.error ?? "Falha ao adicionar campo.");
    const novo: CampoPersonalizado = {
      id: result.id ?? crypto.randomUUID(),
      entidade: campo.entidade,
      chave: campo.chave,
      rotulo: campo.rotulo,
      tipo: campo.tipo,
      visibilidade: campo.visibilidade,
      ativo: true,
    };
    setDados((atual) => ({ ...atual, campos: [...atual.campos, novo] }));
    setCampo({
      entidade: "character",
      chave: "",
      rotulo: "",
      tipo: "text",
      visibilidade: "campaign",
    });
    setAviso("Campo personalizado adicionado.");
  }

  return (
    <div className="mt-6 space-y-4">
      <section className="panel rounded-lg p-5">
        <div className="flex items-center gap-2">
          <Settings2 size={18} className="text-[#d84b57]" />
          <h2 className="text-xl font-extrabold">Identidade da campanha</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-xs font-bold md:col-span-2">
            Nome da campanha
            <input
              className="field mt-1"
              value={dados.nome}
              onChange={(event) => setDados({ ...dados, nome: event.target.value })}
            />
          </label>
          <label className="text-xs font-bold">
            Idioma
            <select className="field mt-1" value={dados.idioma} disabled>
              <option value="pt-BR">Português do Brasil</option>
            </select>
          </label>
          <label className="text-xs font-bold">
            Fuso horário
            <select
              className="field mt-1"
              value={dados.fusoHorario}
              onChange={(event) => setDados({ ...dados, fusoHorario: event.target.value })}
            >
              <option>America/Belem</option>
              <option>America/Sao_Paulo</option>
              <option>America/Manaus</option>
              <option>America/Fortaleza</option>
              <option>America/Recife</option>
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="panel rounded-lg p-5">
          <div className="flex items-center gap-2">
            <Type size={18} className="text-[#d84b57]" />
            <h2 className="font-extrabold">Textos e nomes do sistema</h2>
          </div>
          <p className="mt-2 text-sm text-[#8f9299]">
            Renomeie os recursos para combinar com o seu cenário.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Object.entries(dados.rotulos).map(([chave, valor]) => (
              <label className="text-xs font-bold" key={chave}>
                {chave.toUpperCase()}
                <input
                  className="field mt-1"
                  value={valor}
                  onChange={(event) =>
                    setDados({
                      ...dados,
                      rotulos: { ...dados.rotulos, [chave]: event.target.value },
                    })
                  }
                />
              </label>
            ))}
          </div>
        </section>
        <section className="panel rounded-lg p-5">
          <div className="flex items-center gap-2">
            <Palette size={18} className="text-[#d84b57]" />
            <h2 className="font-extrabold">Cores e aparência</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["destaque", "Cor de destaque"],
              ["energia", "Cor de energia"],
              ["fundo", "Cor de fundo"],
            ].map(([chave, rotulo]) => (
              <label className="text-xs font-bold" key={chave}>
                {rotulo}
                <input
                  type="color"
                  className="field mt-1 h-12"
                  value={dados.tema[chave as keyof typeof dados.tema]}
                  onChange={(event) =>
                    setDados({ ...dados, tema: { ...dados.tema, [chave]: event.target.value } })
                  }
                />
              </label>
            ))}
          </div>
          <div
            className="mt-4 rounded-lg border border-[#34373e] p-4"
            style={{ background: dados.tema.fundo, borderColor: dados.tema.destaque }}
          >
            <p className="text-xs" style={{ color: dados.tema.energia }}>
              PRÉVIA DO TERMINAL
            </p>
            <strong style={{ color: dados.tema.destaque }}>A Convergência começou.</strong>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="panel rounded-lg p-5">
          <div className="flex items-center gap-2">
            <LayoutGrid size={18} className="text-[#d84b57]" />
            <h2 className="font-extrabold">Módulos e recursos</h2>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {Object.entries({
              ...nomesModulos,
              ...Object.fromEntries(
                Object.keys(dados.modulos).map((chave) => [chave, nomesModulos[chave] ?? chave]),
              ),
            }).map(([chave, rotulo]) => (
              <label
                className="flex items-center justify-between rounded border border-[#30333a] p-3 text-sm"
                key={chave}
              >
                <span>{rotulo}</span>
                <input
                  type="checkbox"
                  checked={dados.modulos[chave] ?? false}
                  onChange={(event) => atualizarModulo(chave, event.target.checked)}
                />
              </label>
            ))}
          </div>
        </section>
        <section className="panel rounded-lg p-5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-[#d84b57]" />
            <h2 className="font-extrabold">Regras e consequências</h2>
          </div>
          <label className="mt-4 block text-xs font-bold">
            Quando PV chega a zero
            <select
              className="field mt-1"
              value={dados.regras.zeroPv}
              onChange={(event) =>
                setDados({ ...dados, regras: { ...dados.regras, zeroPv: event.target.value } })
              }
            >
              <option value="dying">Personagem fica morrendo</option>
              <option value="dead">Personagem morre</option>
              <option value="unconscious">Personagem fica inconsciente</option>
              <option value="custom">Consequência personalizada</option>
            </select>
          </label>
          <label className="mt-3 block text-xs font-bold">
            Quando SAN chega a zero
            <select
              className="field mt-1"
              value={dados.regras.zeroSan}
              onChange={(event) =>
                setDados({ ...dados, regras: { ...dados.regras, zeroSan: event.target.value } })
              }
            >
              <option value="absorbed_by_zone">Absorvido pela Zona</option>
              <option value="insane">Insanidade</option>
              <option value="controlled_by_master">Controle passa ao mestre</option>
              <option value="custom">Consequência personalizada</option>
            </select>
          </label>
          <label className="mt-3 block text-xs font-bold">
            Pressão global: {dados.regras.pressao}/7
            <input
              className="mt-2 w-full"
              type="range"
              min={0}
              max={7}
              value={dados.regras.pressao}
              onChange={(event) =>
                setDados({
                  ...dados,
                  regras: { ...dados.regras, pressao: Number(event.target.value) },
                })
              }
            />
          </label>
        </section>
      </div>

      <section className="panel rounded-lg p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Eye size={18} className="text-[#d84b57]" />
              <h2 className="font-extrabold">Campos personalizados</h2>
            </div>
            <p className="mt-2 text-sm text-[#8f9299]">
              Acrescente informações próprias às fichas, habilidades, itens, sessões, encontros,
              mensagens e pistas.
            </p>
          </div>
          <span className="tag">{dados.campos.length} campos</span>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {dados.campos.map((item) => (
            <div className="rounded border border-[#30333a] p-3" key={item.id}>
              <strong className="text-sm">{item.rotulo}</strong>
              <p className="mt-1 text-xs text-[#777a82]">
                {item.entidade} · {item.tipo} · {item.visibilidade}
              </p>
            </div>
          ))}
        </div>
        <form
          className="mt-5 grid gap-3 border-t border-[#30333a] pt-4 md:grid-cols-2 xl:grid-cols-5"
          onSubmit={adicionarCampo}
        >
          <label className="text-xs font-bold">
            Onde aparece
            <select
              className="field mt-1"
              value={campo.entidade}
              onChange={(event) => setCampo({ ...campo, entidade: event.target.value })}
            >
              {entidades.map(([valor, rotulo]) => (
                <option value={valor} key={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold">
            Nome do campo
            <input
              required
              className="field mt-1"
              value={campo.rotulo}
              onChange={(event) => setCampo({ ...campo, rotulo: event.target.value })}
            />
          </label>
          <label className="text-xs font-bold">
            Chave técnica
            <input
              required
              pattern="[a-z][a-z0-9_]+"
              className="field mt-1"
              placeholder="ex.: sinal_da_zona"
              value={campo.chave}
              onChange={(event) =>
                setCampo({ ...campo, chave: event.target.value.toLowerCase().replace(/\s+/g, "_") })
              }
            />
          </label>
          <label className="text-xs font-bold">
            Tipo
            <select
              className="field mt-1"
              value={campo.tipo}
              onChange={(event) => setCampo({ ...campo, tipo: event.target.value })}
            >
              {tiposCampo.map(([valor, rotulo]) => (
                <option value={valor} key={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold">
            Visibilidade
            <select
              className="field mt-1"
              value={campo.visibilidade}
              onChange={(event) => setCampo({ ...campo, visibilidade: event.target.value })}
            >
              <option value="campaign">Toda a campanha</option>
              <option value="owner_only">Somente o dono da ficha</option>
              <option value="gm_only">Somente mestres</option>
              <option value="selected">Participantes escolhidos</option>
              <option value="public">Público</option>
            </select>
          </label>
          <button className="btn md:col-span-2 xl:col-span-5">
            <Plus size={14} /> Adicionar campo
          </button>
        </form>
      </section>

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#4a3034] bg-[#111318]/95 p-4 shadow-2xl backdrop-blur">
        <p className="text-xs text-[#8f9299]">
          As mudanças passam a valer para mestre e jogadores após salvar.
        </p>
        <button className="btn btn-primary" type="button" onClick={() => void salvar()}>
          <Save size={15} /> Salvar todas as configurações
        </button>
      </div>
      {aviso && (
        <p className="text-xs text-[#7bd5a5]" role="status">
          {aviso}
        </p>
      )}
    </div>
  );
}
