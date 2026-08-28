import { expect, test, type Page } from "@playwright/test";

const accessE2e = {
  officeEmail: process.env.E2E_OFFICE_EMAIL,
  officePassword: process.env.E2E_OFFICE_PASSWORD,
  organizationId: process.env.E2E_TEST_ORGANIZATION_ID,
  clientCnpj: process.env.E2E_TEST_CLIENT_CNPJ,
  clientPassword: process.env.E2E_TEST_CLIENT_PASSWORD,
};
const hasClientE2eCredentials = Boolean(accessE2e.clientCnpj && accessE2e.clientPassword);
const serviceWorkflowE2e = {
  enabled: process.env.E2E_ENABLE_SERVICE_MUTATIONS === "true",
  nationalCode: process.env.E2E_SERVICE_NATIONAL_CODE,
  dpsMunicipalCode: process.env.E2E_SERVICE_DPS_MUNICIPAL_CODE,
  dpsCodeSource: process.env.E2E_SERVICE_DPS_CODE_SOURCE,
};
const hasServiceWorkflowE2e = serviceWorkflowE2e.enabled
  && Boolean(accessE2e.officeEmail && accessE2e.officePassword && accessE2e.clientCnpj && accessE2e.clientPassword)
  && Boolean(serviceWorkflowE2e.nationalCode && serviceWorkflowE2e.dpsMunicipalCode && serviceWorkflowE2e.dpsCodeSource);

async function loginAsClient(page: Page) {
  await page.goto("/login");
  await page.getByLabel("CNPJ").fill(accessE2e.clientCnpj!);
  await page.getByLabel("Senha").fill(accessE2e.clientPassword!);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test("visitante sem sessão é direcionado ao login", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Acesse sua conta" })).toBeVisible();
});

test("login do cliente pede somente CNPJ e senha", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("CNPJ")).toBeVisible();
  await expect(page.getByLabel("Senha")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Acesso do escritório" })).toHaveAttribute("href", "/login/escritorio");
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, content: document.documentElement.scrollWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});

test("login administrativo permanece separado", async ({ page }) => {
  await page.goto("/login/escritorio");
  await expect(page.getByRole("heading", { name: "Acesso do escritório" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Senha")).toBeVisible();
});

test("modo mock explícito permite pré-visualizar sem dados fiscais técnicos", async ({ page }) => {
  test.skip(!hasClientE2eCredentials, "Requer credenciais CLIENT_USER configuradas em E2E_*.");
  await loginAsClient(page);
  await page.goto("/app/emitir");

  await expect(page.getByLabel("Tomador")).toBeVisible();
  await expect(page.getByLabel("Serviço", { exact: true })).toBeVisible();
  await expect(page.getByText("cTribNac")).toHaveCount(0);
  await expect(page.getByText("alíquota ISS")).toHaveCount(0);

  await page.getByLabel("Valor total da NFS-e").fill("125,00");
  await page.getByRole("button", { name: "Pré-visualizar NFS-e" }).click();

  await expect(page.getByRole("heading", { name: "Pré-visualização da NFS-e" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Emitir NFS-e" })).toBeEnabled();
});

test("a auditoria de interface não transmite uma NFS-e", async ({ page }) => {
  test.skip(!hasClientE2eCredentials, "Requer credenciais CLIENT_USER configuradas em E2E_*.");
  await loginAsClient(page);
  await page.goto("/app/emitir");
  await page.getByLabel("Valor total da NFS-e").fill("125,00");
  await page.getByRole("button", { name: "Pré-visualizar NFS-e" }).click();

  await expect(page.getByText("Pré-visualização da NFS-e")).toBeVisible();
  await expect(page.getByRole("button", { name: "Emitir NFS-e" })).toBeEnabled();
});

test("navegação se adapta ao viewport", async ({ page }) => {
  test.skip(!hasClientE2eCredentials, "Requer credenciais CLIENT_USER configuradas em E2E_*.");
  await loginAsClient(page);
  await page.goto("/app/emitir");
  const mobile = await page.evaluate(() => window.innerWidth <= 800);

  await expect(page.locator(".sidebar")).toHaveCSS("display", mobile ? "none" : "flex");
  await expect(page.locator(".mobile-nav")).toHaveCSS("display", mobile ? "grid" : "none");
});

test("office cria, bloqueia, reativa e redefine acesso de uma organização exclusiva de E2E", async ({ page }) => {
  test.skip(Object.values(accessE2e).some((value) => !value), "Requer credenciais e organização isolada configuradas em E2E_*.");
  const officeLogin = async () => {
    await page.goto("/login/escritorio");
    await page.getByLabel("Email").fill(accessE2e.officeEmail!);
    await page.getByLabel("Senha").fill(accessE2e.officePassword!);
    await page.getByRole("button", { name: "Entrar no escritório" }).click();
    await expect(page).toHaveURL(/\/admin/);
  };
  await officeLogin();
  await page.goto(`/admin/empresas/${accessE2e.organizationId}?tab=users`);
  if (await page.getByText("Nenhum acesso cadastrado.").isVisible().catch(() => false)) {
    await page.getByLabel("Nova senha").fill(accessE2e.clientPassword!);
    await page.getByLabel("Confirmar senha").fill(accessE2e.clientPassword!);
    await page.getByRole("button", { name: "Criar acesso" }).click();
  } else {
    if (await page.getByRole("button", { name: "Reativar acesso" }).isVisible().catch(() => false)) await page.getByRole("button", { name: "Reativar acesso" }).click();
    await page.getByRole("button", { name: "Redefinir senha" }).click();
    await page.getByLabel("Nova senha").fill(accessE2e.clientPassword!);
    await page.getByLabel("Confirmar senha").fill(accessE2e.clientPassword!);
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
  }
  await expect(page.getByText("Ativo", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sair" }).click();
  await page.getByLabel("CNPJ").fill(accessE2e.clientCnpj!);
  await page.getByLabel("Senha").fill(accessE2e.clientPassword!);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole("button", { name: "Sair" }).click();

  await officeLogin();
  await page.goto(`/admin/empresas/${accessE2e.organizationId}?tab=users`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Bloquear acesso" }).click();
  await expect(page.getByText("Bloqueado", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sair" }).click();
  await page.getByLabel("CNPJ").fill(accessE2e.clientCnpj!);
  await page.getByLabel("Senha").fill(accessE2e.clientPassword!);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("CNPJ ou senha inválidos.")).toBeVisible();

  await page.getByRole("link", { name: "Acesso do escritório" }).click();
  await page.getByLabel("Email").fill(accessE2e.officeEmail!);
  await page.getByLabel("Senha").fill(accessE2e.officePassword!);
  await page.getByRole("button", { name: "Entrar no escritório" }).click();
  await page.goto(`/admin/empresas/${accessE2e.organizationId}?tab=users`);
  await page.getByRole("button", { name: "Reativar acesso" }).click();
  await expect(page.getByText("Ativo", { exact: true })).toBeVisible();
});

test("cliente envia serviço e escritório conclui a validação fiscal", async ({ page }) => {
  test.skip(!hasServiceWorkflowE2e, "Requer organização isolada e E2E_ENABLE_SERVICE_MUTATIONS=true.");
  const serviceName = `Serviço E2E ${Date.now()}`;

  await loginAsClient(page);
  await page.goto("/app/servicos");
  await page.getByRole("button", { name: "Novo serviço" }).first().click();
  await page.getByLabel("Nome do serviço").fill(serviceName);
  await page.getByLabel("Descrição padrão").fill("Serviço controlado para validar o workflow E2E.");
  await page.getByRole("button", { name: /Salvar serviço/ }).click();
  const clientRow = page.locator("article").filter({ hasText: serviceName });
  await clientRow.getByRole("button", { name: "Enviar para validação" }).click();
  await expect(clientRow.getByText("Em análise", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sair" }).click();

  await page.goto("/login/escritorio");
  await page.getByLabel("Email").fill(accessE2e.officeEmail!);
  await page.getByLabel("Senha").fill(accessE2e.officePassword!);
  await page.getByRole("button", { name: "Entrar no escritório" }).click();
  await page.goto(`/admin/servicos?status=PENDING_REVIEW&q=${encodeURIComponent(serviceName)}`);
  await page.getByRole("link", { name: /Analisar/ }).click();
  await page.getByPlaceholder("Buscar código ou descrição no catálogo nacional").fill(serviceWorkflowE2e.nationalCode!);
  await page.locator(".catalog-option").filter({ hasText: serviceWorkflowE2e.nationalCode! }).first().click();
  await page.locator('input[name="municipal-mapping"]').first().check();
  await page.getByLabel(/Código DPS municipal/).fill(serviceWorkflowE2e.dpsMunicipalCode!);
  await page.getByLabel("Fonte do código DPS municipal").fill(serviceWorkflowE2e.dpsCodeSource!);
  await page.getByRole("button", { name: "Salvar configuração" }).click();
  await page.getByRole("button", { name: "Aprovar serviço" }).click();
  await expect(page.getByText("Pronto para emitir", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sair" }).click();

  await loginAsClient(page);
  await page.goto("/app/servicos");
  await expect(page.locator("article").filter({ hasText: serviceName }).getByText("Pronto para emitir", { exact: true })).toBeVisible();
  await page.goto("/app/emitir");
  await expect(page.getByLabel("Serviço", { exact: true }).locator(`option:has-text("${serviceName}")`)).toHaveCount(1);
});

test("escritório solicita informação e cliente corrige e reenvia", async ({ page }) => {
  test.skip(!serviceWorkflowE2e.enabled || !hasClientE2eCredentials || !accessE2e.officeEmail || !accessE2e.officePassword, "Requer organização isolada e E2E_ENABLE_SERVICE_MUTATIONS=true.");
  const serviceName = `Serviço E2E informação ${Date.now()}`;
  const requestMessage = "Confirme se o serviço é prestado no município informado.";

  await loginAsClient(page);
  await page.goto("/app/servicos");
  await page.getByRole("button", { name: "Novo serviço" }).first().click();
  await page.getByLabel("Nome do serviço").fill(serviceName);
  await page.getByLabel("Descrição padrão").fill("Serviço controlado para testar pedido de informação.");
  await page.getByRole("button", { name: /Salvar serviço/ }).click();
  await page.locator("article").filter({ hasText: serviceName }).getByRole("button", { name: "Enviar para validação" }).click();
  await page.getByRole("button", { name: "Sair" }).click();

  await page.goto("/login/escritorio");
  await page.getByLabel("Email").fill(accessE2e.officeEmail!);
  await page.getByLabel("Senha").fill(accessE2e.officePassword!);
  await page.getByRole("button", { name: "Entrar no escritório" }).click();
  await page.goto(`/admin/servicos?status=PENDING_REVIEW&q=${encodeURIComponent(serviceName)}`);
  await page.getByRole("link", { name: /Analisar/ }).click();
  await page.getByLabel("Mensagem para o cliente").fill(requestMessage);
  await page.getByRole("button", { name: "Solicitar informação" }).click();
  await page.getByRole("button", { name: "Sair" }).click();

  await loginAsClient(page);
  await page.goto("/app/servicos");
  const clientRow = page.locator("article").filter({ hasText: serviceName });
  await expect(clientRow.getByText("Precisa de informação", { exact: true })).toBeVisible();
  await expect(clientRow.getByText(requestMessage)).toBeVisible();
  await clientRow.getByRole("button", { name: "Editar" }).click();
  await page.getByLabel(/Observação para o escritório/).fill("Confirmado: prestação habitual no município informado.");
  await page.getByRole("button", { name: /Salvar serviço/ }).click();
  await page.locator("article").filter({ hasText: serviceName }).getByRole("button", { name: "Reenviar" }).click();
  await expect(page.locator("article").filter({ hasText: serviceName }).getByText("Em análise", { exact: true })).toBeVisible();
});
