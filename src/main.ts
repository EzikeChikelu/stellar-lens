import "./style.css";
import { classifyLookup } from "./validation";

type Network = "public" | "testnet";
type JsonObject = Record<string, unknown>;
const HORIZON: Record<Network, string> = { public: "https://horizon.stellar.org", testnet: "https://horizon-testnet.stellar.org" };
const form = document.querySelector<HTMLFormElement>("#lookup-form")!;
const input = document.querySelector<HTMLInputElement>("#lookup-input")!;
const networkSelect = document.querySelector<HTMLSelectElement>("#network")!;
const button = document.querySelector<HTMLButtonElement>("#inspect-button")!;
const statusBox = document.querySelector<HTMLDivElement>("#status")!;
const resultBox = document.querySelector<HTMLElement>("#result")!;
form.addEventListener("submit", async (event) => { event.preventDefault(); await inspect(input.value, networkSelect.value as Network); });

async function inspect(raw: string, network: Network): Promise<void> {
  const value = raw.trim(); const kind = classifyLookup(value);
  resultBox.hidden = true; resultBox.replaceChildren();
  if (kind === "secret") { showStatus("That looks like a secret key. Do not share it. Enter only a public account key or transaction hash.", "error"); return; }
  if (kind === "invalid") { showStatus("Enter a valid Stellar account public key or a 64-character transaction hash.", "error"); return; }
  setLoading(true); showStatus("Contacting the selected Horizon network…", "loading");
  const endpoint = kind === "account" ? `${HORIZON[network]}/accounts/${encodeURIComponent(value)}` : `${HORIZON[network]}/transactions/${encodeURIComponent(value)}`;
  try {
    const response = await fetch(endpoint, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
    if (response.status === 404) { showStatus(`No ${kind} was found on the ${networkLabel(network)}. Check the network selector and value.`, "error"); return; }
    if (!response.ok) throw new Error(`Horizon returned HTTP ${response.status}.`);
    const data = await response.json() as JsonObject;
    showStatus(`Found ${kind} on ${networkLabel(network)}.`, "success");
    if (kind === "account") renderAccount(data, network); else renderTransaction(data, network);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error.";
    showStatus(`Could not complete lookup. ${message} Check your connection and try again.`, "error");
  } finally { setLoading(false); }
}
function renderAccount(data: JsonObject, network: Network): void {
  const balances = Array.isArray(data.balances) ? data.balances as JsonObject[] : [];
  const heading = document.createElement("div"); heading.className = "result-heading";
  heading.innerHTML = `<div><p class="eyebrow">ACCOUNT</p><h2>Account details</h2></div><span class="pill">${escapeHtml(networkLabel(network))}</span>`; resultBox.append(heading);
  addField("Public key", str(data.account_id), true); addField("Sequence number", str(data.sequence)); addField("Last modified ledger", str(data.last_modified_ledger)); addField("Subentries", str(data.subentry_count)); addField("Home domain", str(data.home_domain) || "Not set");
  const title = document.createElement("h3"); title.className = "subheading"; title.textContent = `Balances (${balances.length})`; resultBox.append(title);
  if (!balances.length) { addText("No balances were returned for this account."); }
  else { const list = document.createElement("div"); list.className = "balance-list"; for (const balance of balances) { const asset = balance.asset_type === "native" ? "XLM" : `${str(balance.asset_code) || "Unknown asset"} · ${str(balance.asset_issuer)}`; const row = document.createElement("div"); row.className = "balance-row"; const left = document.createElement("span"); left.className = "asset-name"; left.textContent = asset; const right = document.createElement("strong"); right.textContent = str(balance.balance) || "0"; row.append(left, right); list.append(row); } resultBox.append(list); }
  resultBox.hidden = false;
}
function renderTransaction(data: JsonObject, network: Network): void {
  const heading = document.createElement("div"); heading.className = "result-heading"; heading.innerHTML = `<div><p class="eyebrow">TRANSACTION</p><h2>Transaction details</h2></div><span class="pill">${escapeHtml(networkLabel(network))}</span>`; resultBox.append(heading);
  addField("Transaction hash", str(data.hash), true); addField("Status", data.successful === true ? "Successful" : data.successful === false ? "Failed" : "Unknown"); addField("Source account", str(data.source_account), true); addField("Ledger", str(data.ledger)); addField("Created at", str(data.created_at)); addField("Fee charged (stroops)", str(data.fee_charged)); addField("Operations", str(data.operation_count)); addField("Memo type", str(data.memo_type) || "none"); addField("Memo", str(data.memo) || "none"); addField("Envelope XDR", str(data.envelope_xdr), true); resultBox.hidden = false;
}
function addField(label: string, value: string, mono = false): void {
  const row = document.createElement("div"); row.className = "field-row"; const name = document.createElement("span"); name.className = "field-label"; name.textContent = label; const content = document.createElement("span"); content.className = mono ? "field-value mono" : "field-value"; content.textContent = value || "Not available"; row.append(name, content);
  if (mono && value) { const copy = document.createElement("button"); copy.type = "button"; copy.className = "copy-button"; copy.textContent = "Copy"; copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(value); copy.textContent = "Copied"; window.setTimeout(() => { copy.textContent = "Copy"; }, 1200); } catch { copy.textContent = "Copy unavailable"; } }); row.append(copy); }
  resultBox.append(row);
}
function addText(text: string): void { const p = document.createElement("p"); p.className = "empty-note"; p.textContent = text; resultBox.append(p); }
function showStatus(message: string, type: "loading" | "success" | "error"): void { statusBox.hidden = false; statusBox.className = `status ${type}`; statusBox.textContent = message; }
function setLoading(loading: boolean): void { button.disabled = loading; button.textContent = loading ? "Inspecting…" : "Inspect ↗"; }
function networkLabel(network: Network): string { return network === "public" ? "Public network" : "Testnet"; }
function str(value: unknown): string { return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : ""; }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c); }
