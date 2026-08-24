import { expect, test } from "@playwright/test";

test("abre sem login e conclui emissão mock", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Olá, João" })).toBeVisible();
  await page.goto("/app/emitir");
  await page.getByRole("button", { name: "Pré-visualizar NFS-e" }).click();
  await expect(page.getByRole("heading", { name: "Pré-visualização da NFS-e" })).toBeVisible();
  await page.getByRole("button", { name: "Emitir NFS-e" }).click();
  await expect(page.getByRole("heading", { name: "NFS-e emitida" })).toBeVisible();
});

test("copiar dados preserva o tomador e não emite automaticamente", async ({ page }) => {
  await page.goto("/app/emitir");
  await page.getByLabel("Tomador").selectOption("Mercado Boa Vista");
  await page.getByRole("button", { name: "Copiar última NFS-e emitida" }).click();
  await expect(page.getByLabel("Tomador")).toHaveValue("Mercado Boa Vista");
  await expect(page.getByText("Nenhuma nota foi emitida.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Emitir NFS-e" })).toBeDisabled();
});

test("duplo clique não cria duas emissões", async ({ page }) => {
  await page.goto("/app/emitir");
  await page.getByRole("button", { name: "Pré-visualizar NFS-e" }).click();
  const button = page.getByRole("button", { name: "Emitir NFS-e" });
  await button.dblclick();
  await expect(page.getByRole("heading", { name: "NFS-e emitida" })).toBeVisible();
});
