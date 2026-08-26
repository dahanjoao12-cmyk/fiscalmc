import { expect, test } from "@playwright/test";

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
