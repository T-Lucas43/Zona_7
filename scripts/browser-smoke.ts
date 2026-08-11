import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (message) => console.log("console", message.type(), message.text()));
page.on("pageerror", (error) => console.log("pageerror", error.message));
page.on("requestfailed", (request) =>
  console.log("requestfailed", request.url(), request.failure()?.errorText),
);
page.on("response", async (response) => {
  if (response.status() === 403) {
    console.log("forbidden", response.url(), await response.text().catch(() => "sem corpo"));
  }
  if (response.url().includes("/api/dice/roll")) console.log("dice-response", response.status());
});

await page.goto("http://localhost:3000/login");
await page.getByRole("button", { name: "Jogador" }).click();
await page.goto("http://localhost:3000/app/session/session-01");
await page.waitForTimeout(1000);
await page.getByLabel("Fórmula de dados").fill("4d20kh1+10");
await page.getByRole("button", { name: "Rolar" }).click();
await page.waitForTimeout(1500);
console.log("result-count", await page.getByText("4d20kh1+10").count());
console.log("alerts", await page.getByRole("alert").allTextContents());
await browser.close();
