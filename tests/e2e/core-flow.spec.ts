import { expect, test } from "@playwright/test";

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
});

test("login administrativo permanece separado", async ({ page }) => {
  await page.goto("/login/escritorio");
  await expect(page.getByRole("heading", { name: "Acesso do escritório" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Senha")).toBeVisible();
});

test("modo mock explícito permite pré-visualizar sem dados fiscais técnicos", async ({ page }) => {
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
  await page.goto("/app/emitir");
  await page.getByLabel("Valor total da NFS-e").fill("125,00");
  await page.getByRole("button", { name: "Pré-visualizar NFS-e" }).click();

  await expect(page.getByText("Pré-visualização da NFS-e")).toBeVisible();
  await expect(page.getByRole("button", { name: "Emitir NFS-e" })).toBeEnabled();
});

test("navegação se adapta ao viewport", async ({ page }) => {
  await page.goto("/app/emitir");
  const mobile = await page.evaluate(() => window.innerWidth <= 800);

  await expect(page.locator(".sidebar")).toHaveCSS("display", mobile ? "none" : "flex");
  await expect(page.locator(".mobile-nav")).toHaveCSS("display", mobile ? "grid" : "none");
});

const accessE2e = {
  officeEmail: process.env.E2E_OFFICE_EMAIL,
  officePassword: process.env.E2E_OFFICE_PASSWORD,
  organizationId: process.env.E2E_TEST_ORGANIZATION_ID,
  clientCnpj: process.env.E2E_TEST_CLIENT_CNPJ,
  clientPassword: process.env.E2E_TEST_CLIENT_PASSWORD,
};

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
