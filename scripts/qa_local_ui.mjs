import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_CORE_PATH;
if (!playwrightPath) throw new Error('PLAYWRIGHT_CORE_PATH is required');
const { chromium } = require(playwrightPath);

const baseUrl = process.env.PROMARKIA_QA_URL || 'http://localhost:5173';
const cdpUrl = process.env.PROMARKIA_QA_CDP || 'http://127.0.0.1:18800';
const outputDir = path.resolve('artifacts/qa');
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.connectOverCDP(cdpUrl);
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('response', (response) => {
  if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`);
});

await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 45_000 });
await page.screenshot({ path: path.join(outputDir, 'workspace-desktop.png'), fullPage: true });
const title = await page.title();
const body = await page.locator('body').innerText();
const apiHealth = await page.evaluate(async () => (await fetch('/api/local/health')).json());
const capabilities = await page.evaluate(async () => (await fetch('/api/local/capabilities')).json());

const dialogChecks = [];
async function checkDialog(buttonName, expectedText, screenshotName) {
  const button = page.getByText(buttonName, { exact: true }).first();
  await button.click();
  const dialog = page.getByRole('dialog').last();
  await dialog.waitFor({ state: 'visible' });
  const text = await dialog.innerText();
  if (!text.includes(expectedText)) throw new Error(`${buttonName} dialog missing ${expectedText}`);
  await page.screenshot({ path: path.join(outputDir, screenshotName), fullPage: true });
  dialogChecks.push(buttonName);
  const close = dialog.getByRole('button', { name: /close/i }).last();
  await close.click();
  await dialog.waitFor({ state: 'hidden' });
}

await checkDialog('API Keys', 'Primary chat model', 'provider-settings.png');
await checkDialog('Approvals', 'External writes never execute', 'approval-queue.png');
await checkDialog('MCP Servers', 'Connect local stdio or remote HTTP MCP tools', 'mcp-manager.png');
await checkDialog('Connect Integrations', 'Credentials stay encrypted', 'integrations.png');
await checkDialog('Scheduled Tasks', 'Scheduled Tasks', 'schedules.png');
await checkDialog('My Artifacts', 'Artifacts', 'artifacts.png');

const launchpadButton = page.getByRole('button', { name: /launchpad/i }).first();
await launchpadButton.click();
const launchpadDialog = page.getByRole('dialog').last();
await launchpadDialog.waitFor({ state: 'visible' });
if (!(await launchpadDialog.innerText()).includes('Launchpad')) throw new Error('Launchpad did not open');
await page.screenshot({ path: path.join(outputDir, 'launchpad.png'), fullPage: true });
dialogChecks.push('Launchpad');
await launchpadDialog.getByRole('button', { name: /close/i }).last().click();

await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: path.join(outputDir, 'workspace-mobile.png'), fullPage: true });

const result = {
  title,
  bodyPreview: body.slice(0, 500),
  mode: apiHealth.mode,
  squadCount: capabilities.squads?.length || 0,
  billing: capabilities.features?.billing,
  firestore: capabilities.features?.firebase,
  dialogs: dialogChecks,
  errors,
};
console.log(JSON.stringify(result, null, 2));

await context.close();
await browser.close();

if (apiHealth.mode !== 'local') process.exitCode = 1;
if (capabilities.squads?.length !== 16) process.exitCode = 1;
if (capabilities.features?.billing !== false || capabilities.features?.firebase !== false) process.exitCode = 1;
if (errors.length) process.exitCode = 1;
