import { expect, test } from "@playwright/test";

test("mestre acessa o painel e controla uma sessão", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Mestre" }).click();
  await page.waitForURL("**/master");
  await expect(page.getByRole("heading", { name: "Painel do mestre" })).toBeVisible();
  await page.goto("/master/campaigns/11111111-1111-4111-8111-111111111111/sessions");
  await expect(
    page.getByRole("heading", { name: "Sessão 01 — Sete Segundos Antes" }),
  ).toBeVisible();
});

test("novo layout recolhe a navegação e o mapa não oferece conexão de tokens", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  await page.getByRole("button", { name: "Mestre" }).click();
  await page.waitForURL("**/master");
  await page.getByRole("button", { name: "Recolher barra lateral" }).click();
  await expect(page.getByRole("button", { name: "Expandir barra lateral" })).toBeVisible();
  await page.goto("/master/campaigns/11111111-1111-4111-8111-111111111111/maps");
  await expect(page.getByRole("heading", { name: "Mapas e tokens" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Conectar tokens" })).toHaveCount(0);
});

test("jogador acessa somente a própria experiência mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/login");
  await page.getByRole("button", { name: "Jogador" }).click();
  await page.waitForURL("**/app");
  await expect(page.getByRole("heading", { name: /Boa noite, Davi/ })).toBeVisible();
  await expect(page.locator(".mobile-nav")).toHaveCount(0);
  await page.getByRole("button", { name: "Abrir menu de navegação" }).click();
  const playerMenu = page.getByRole("dialog", { name: "Menu do jogador" });
  await expect(playerMenu).toBeVisible();
  await expect(playerMenu.getByRole("link", { name: "Minha ficha" })).toBeVisible();
  await expect(playerMenu.getByRole("link", { name: "Inventário" })).toBeVisible();
  await expect(playerMenu.getByRole("link", { name: "Habilidades" })).toBeVisible();
  await expect(playerMenu.getByRole("link", { name: "Mensagens" })).toBeVisible();
  await expect(playerMenu.getByRole("link", { name: "Pistas" })).toBeVisible();
  await expect(playerMenu.getByRole("link", { name: "Livro de anotações" })).toBeVisible();
  await expect(playerMenu.getByRole("link", { name: "Sala ao vivo" })).toBeVisible();
  await playerMenu.getByRole("button", { name: "Fechar menu de navegação" }).click();
  await page.getByRole("link", { name: /Entrar na sala/ }).click();
  await expect(page.getByRole("heading", { name: "A transmissão impossível" })).toBeVisible();
  await expect(page.locator(".player-live-sheet").getByText("Davi Brito")).toBeVisible();
  const firstToken = page.locator(".map-token").first();
  const tokenBox = await firstToken.boundingBox();
  expect(tokenBox?.width ?? 999).toBeLessThan(60);
  await page.getByRole("button", { name: /notificações/ }).click();
  const notificationPanel = page.locator(".notification-panel");
  await expect(notificationPanel).toBeVisible();
  const notificationBox = await notificationPanel.boundingBox();
  expect(notificationBox?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((notificationBox?.x ?? 0) + (notificationBox?.width ?? 999)).toBeLessThanOrEqual(375);
});

test("rolagem é produzida pelo servidor e auditável", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Jogador" }).click();
  await page.goto("/app/session/session-01");
  await page.getByLabel("Fórmula de dados").fill("4d20kh1+10");
  await page.getByRole("button", { name: "Rolar" }).click();
  await expect(page.getByRole("img", { name: "Dado rolando" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Resultado do dado:/ })).toBeVisible();
  await expect(page.getByText("4d20kh1+10")).toBeVisible();
});

test("mestre enxerga as seis fichas e a configuração completa", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Mestre" }).click();
  await page.goto("/master/campaigns/11111111-1111-4111-8111-111111111111/characters");
  await expect(page.getByRole("heading", { name: "Personagens" })).toBeVisible();
  await expect(page.getByText("Gragas", { exact: true })).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "NEX" })).toHaveCount(6);
  await page.goto("/master/campaigns/11111111-1111-4111-8111-111111111111/settings");
  await expect(page.getByRole("heading", { name: "Configurações" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Identidade da campanha" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Módulos e recursos" })).toBeVisible();
});

test("jogador solicita uso funcional de habilidade", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Jogador" }).click();
  await page.goto("/app/characters/davi/abilities");
  const ability = page.locator("article").filter({ hasText: "Sempre no Ar" });
  await ability.getByRole("button", { name: "Solicitar uso ao mestre" }).click();
  await expect(ability.getByText("Aguardando decisão do mestre.")).toBeVisible();
});

test("mestre valida e inicia um roteiro publicado", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Mestre" }).click();
  await page.goto("/master/campaigns/11111111-1111-4111-8111-111111111111/scripts");
  await page.getByRole("button", { name: "Validar sem executar" }).click();
  await expect(page.getByText("Validação concluída. Nenhuma ação foi executada.")).toBeVisible();
  await page.getByRole("button", { name: "Executar versão publicada" }).click();
  await expect(page.getByText(/Execução em execução/)).toBeVisible();
});

test("central da sessão reúne controle, entregas e Gragas jogável", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Mestre" }).click();
  await page.goto("/master/campaigns/11111111-1111-4111-8111-111111111111/sessions");
  await expect(
    page.getByRole("heading", { name: "Sessão 01 — Sete Segundos Antes" }),
  ).toBeVisible();
  await expect(page.locator(".session-map-viewport")).toBeVisible();
  await page.getByRole("button", { name: "Recolher ferramentas do mapa" }).click();
  await expect(page.getByRole("button", { name: "Abrir ferramentas do mapa" })).toBeVisible();
  await page.getByRole("button", { name: "Abrir ferramentas do mapa" }).click();
  await page.getByRole("button", { name: "Recolher painel dos personagens" }).click();
  await expect(page.getByRole("button", { name: "Abrir painel dos personagens" })).toBeVisible();
  await page.getByRole("button", { name: "Abrir painel dos personagens" }).click();
  const gragasToken = page.getByRole("button", { name: "Token de Gragas" });
  await expect(gragasToken.locator(".map-token-head")).toHaveCSS(
    "background-image",
    /personagens-zona7/,
  );
  await page.getByRole("button", { name: "Aumentar zoom" }).click();
  await expect(page.getByText("125%", { exact: true })).toBeVisible();
  await gragasToken.click();
  await expect(
    page.locator("#acoes-rapidas").getByRole("heading", { name: "Gragas" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ocultar" }).click();
  await expect(page.getByText("Gragas foi ocultado da tela dos jogadores.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Token de Gragas" })).toHaveCount(0);
  await page
    .locator("details")
    .filter({ hasText: "Entregar item ou pista" })
    .locator("summary")
    .click();
  await page.getByPlaceholder("Nome do item").fill("Cartão vermelho");
  await page.getByPlaceholder("Descrição ou conteúdo").fill("Abre a porta do estúdio.");
  await page.getByRole("button", { name: "Entregar e notificar" }).click();
  await expect(page.getByText(/Item entregue a Gragas/)).toBeVisible();
});

test("mestre configura a ficha liberada para o jogador", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Mestre" }).click();
  await page.goto("/master/campaigns/11111111-1111-4111-8111-111111111111/characters/davi");
  await expect(page.getByRole("heading", { name: "O que aparece para o jogador" })).toBeVisible();
  await page.getByLabel("Fraquezas conhecidas").check();
  await page.getByRole("button", { name: "Salvar visibilidade" }).click();
  await expect(page.getByText("Ficha do jogador atualizada.")).toBeVisible();
});

test("mestre cria conta e atribui um personagem", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Mestre" }).click();
  await page.goto("/master/campaigns/11111111-1111-4111-8111-111111111111/members");
  await page.getByLabel("Nome", { exact: true }).fill("Jogador Novo");
  await page.getByLabel("E-mail").fill("jogador.novo@zona7.local");
  await page
    .getByLabel("Personagem atribuído")
    .selectOption({ label: "Gragas — Hospedeiro do Revide" });
  await page.getByRole("button", { name: "Gerar" }).click();
  await page.getByRole("button", { name: "Criar conta e atribuir" }).click();
  await expect(page.getByText(/Conta de Jogador Novo criada/)).toBeVisible();
  const assignedCharacter = page.getByRole("combobox", {
    name: "Personagem de Jogador Novo",
    exact: true,
  });
  await expect(assignedCharacter).toHaveValue("gragas");
  await assignedCharacter.selectOption("");
  await page.getByRole("button", { name: "Salvar personagem de Jogador Novo" }).click();
  await expect(page.getByText("A ficha foi removida da conta de Jogador Novo.")).toBeVisible();
});

test("mestre cria personagem jogável e pode vincular conta", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Mestre" }).click();
  await page.goto("/master/campaigns/11111111-1111-4111-8111-111111111111/characters");
  await page.getByRole("button", { name: "Criar personagem" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Nina Sete");
  await page.getByLabel("Codinome").fill("A Frequência");
  await page.getByRole("button", { name: "Criar ficha completa" }).click();
  await expect(page.getByText("Nina Sete foi criado como personagem jogável.")).toBeVisible();
});

test("mestre envia retrato de ator e o insere na cena", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Mestre" }).click();
  await page.goto("/master/campaigns/11111111-1111-4111-8111-111111111111/actors");
  const rivaldo = page.locator("article").filter({ hasText: "Rivaldo" });
  await rivaldo.locator('input[type="file"]').setInputFiles("public/personagens-zona7.png");
  await expect(page.getByText("Retrato de Rivaldo atualizado")).toBeVisible({ timeout: 15_000 });
  await rivaldo.getByRole("button", { name: "Inserir para todos" }).click();
  await expect(page.getByText(/Rivaldo foi inserido em Estúdio dos Sete Segundos/)).toBeVisible();
});

test("jogador vê apenas seu mural e escreve no livro de anotações", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Jogador" }).click();
  await page.goto("/app/characters/davi/handouts");
  await expect(page.getByRole("heading", { name: "Mural de Investigação" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Registro 07-C" })).toBeVisible();
  await page.goto("/app/characters/davi/notebook");
  await expect(page.getByRole("heading", { name: "Livro de anotações" })).toBeVisible();
  await page.getByLabel("Título da página").fill("Suspeita sobre o corredor");
  await page.getByLabel("Conteúdo da página").fill("A saída muda quando ninguém observa o mapa.");
  await page.getByRole("button", { name: "Salvar página" }).click();
  await expect(page.getByText("Página salva no caderno.")).toBeVisible();
});

test("mestre consulta e registra páginas nos cadernos dos jogadores", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Mestre" }).click();
  await page.goto("/master/campaigns/11111111-1111-4111-8111-111111111111/notebooks");
  await expect(page.getByRole("heading", { name: "Cadernos dos jogadores" })).toBeVisible();
  await page.getByLabel("Título da página").fill("Registro do mestre");
  await page.getByLabel("Conteúdo da página").fill("Observação acrescentada durante a sessão.");
  await page.getByRole("button", { name: "Salvar página" }).click();
  await expect(page.getByText("Página salva no caderno.")).toBeVisible();
});

test("mestre publica o mesmo roteiro sem perder a versão disponível", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Mestre" }).click();
  await page.goto("/master/campaigns/11111111-1111-4111-8111-111111111111/scripts");
  await page.getByRole("button", { name: "Validar e publicar" }).click();
  await expect(page.getByText(/Roteiro publicado como versão|já era a versão/)).toBeVisible();
});
