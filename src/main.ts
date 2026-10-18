import "./style.css";
import { classifyLookup } from "./validation";

type Network = "public" | "testnet";
type JsonObject = Record<string, unknown>;
type HorizonPage = { _embedded?: { records?: JsonObject[] } };
const HORIZON: Record<Network, string> = {
  public: "https://horizon.stellar.org",
  testnet: "https://horizon-testnet.stellar.org",
};
const form = document.querySelector<HTMLFormElement>("#lookup-form")!;
const input = document.querySelector<HTMLInputElement>("#lookup-input")!;
const networkSelect = document.querySelector<HTMLSelectElement>("#network")!;
const button = document.querySelector<HTMLButtonElement>("#inspect-button")!;
const statusBox = document.querySelector<HTMLDivElement>("#status")!;
const resultBox = document.querySelector<HTMLElement>("#result")!;
let activeRequest = 0;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await inspect(input.value, networkSelect.value as Network);
});

async function inspect(raw: string, network: Network): Promise<void> {
  const value = raw.trim();
  const kind = classifyLookup(value);
  const requestId = ++activeRequest;
  resultBox.hidden = true;
  resultBox.replaceChildren();

  if (kind === "secret") {
    showStatus("That looks like a secret key. Do not share it. Enter only a public account key or transaction hash.", "error");
    return;
  }
  if (kind === "invalid") {
    showStatus("Enter a valid Stellar account public key or a 64-character transaction hash.", "error");
    return;
  }

  setLoading(true);
  showStatus("Contacting the selected Horizon network…", "loading");
  const endpoint = kind === "account"
    ? `${HORIZON[network]}/accounts/${encodeURIComponent(value)}`
    : `${HORIZON[network]}/transactions/${encodeURIComponent(value)}`;

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 404) {
      showStatus(`No ${kind} was found on the ${networkLabel(network)}. Check the network selector and value.`, "error");
      return;
    }
    if (!response.ok) throw new Error(`Horizon returned HTTP ${response.status}.`);
    const data = await response.json() as JsonObject;
    if (requestId !== activeRequest) return;

    showStatus(`Found ${kind} on ${networkLabel(network)}.`, "success");
    if (kind === "account") renderAccount(data, network);
    else renderTransaction(data, network);
  } catch (error) {
    if (requestId !== activeRequest) return;
    const message = error instanceof Error ? error.message : "Unknown network error.";
    showStatus(`Could not complete lookup. ${message} Check your connection and try again.`, "error");
  } finally {
    if (requestId === activeRequest) setLoading(false);
  }
}

function renderAccount(data: JsonObject, network: Network): void {
  const accountId = str(data.account_id);
  const balances = Array.isArray(data.balances) ? data.balances as JsonObject[] : [];
  const heading = makeResultHeading("ACCOUNT", "Account details", network);
  addExplorerLink(heading, explorerUrl(network, "account", accountId), "View in Stellar Expert");
  resultBox.append(heading);
  addField("Public key", accountId, true);
  addField("Sequence number", str(data.sequence));
  addField("Last modified ledger", str(data.last_modified_ledger));
  addField("Subentries", str(data.subentry_count));
  addField("Home domain", str(data.home_domain) || "Not set");

  const title = document.createElement("h3");
  title.className = "subheading";
  title.textContent = `Balances (${balances.length})`;
  resultBox.append(title);

  if (!balances.length) {
    addText("No balances were returned for this account.");
  } else {
    const list = document.createElement("div");
    list.className = "balance-list";
    for (const balance of balances) {
      const native = balance.asset_type === "native";
      const code = native ? "XLM" : str(balance.asset_code) || "Unknown asset";
      const issuer = str(balance.asset_issuer);
      const row = document.createElement("div");
      row.className = "balance-row";
      const left = document.createElement("div");
      left.className = "asset-details";
      const name = document.createElement("span");
      name.className = "asset-name";
      name.textContent = code;
      left.append(name);
      if (issuer) {
        const issuerLine = document.createElement("span");
        issuerLine.className = "asset-issuer";
        issuerLine.textContent = `Issuer: ${shorten(issuer)}`;
        issuerLine.title = issuer;
        left.append(issuerLine);
      } else if (native) {
        const nativeLabel = document.createElement("span");
        nativeLabel.className = "asset-issuer";
        nativeLabel.textContent = "Native Stellar asset";
        left.append(nativeLabel);
      }
      const right = document.createElement("strong");
      right.className = "balance-amount";
      right.textContent = formatAmount(str(balance.balance));
      row.append(left, right);
      if (issuer) {
        const copyIssuer = makeCopyButton("Copy issuer", issuer);
        row.append(copyIssuer);
      }
      list.append(row);
    }
    resultBox.append(list);
  }
  resultBox.hidden = false;
}

function renderTransaction(data: JsonObject, network: Network): void {
  const hash = str(data.hash);
  const heading = makeResultHeading("TRANSACTION", "Transaction details", network);
  addExplorerLink(heading, explorerUrl(network, "tx", hash), "View in Stellar Expert");
  resultBox.append(heading);
  addField("Transaction hash", hash, true);
  const success = data.successful === true ? "Successful" : data.successful === false ? "Failed" : "Unknown";
  addField("Status", success);
  addField("Source account", str(data.source_account), true);
  addField("Ledger", str(data.ledger));
  addField("Created at", formatDate(str(data.created_at)));
  const feeStroops = str(data.fee_charged);
  addField("Fee charged", feeStroops ? `${feeStroops} stroops (${formatXlmFee(feeStroops)} XLM)` : "Not available");
  addField("Operations", str(data.operation_count));
  addField("Memo type", str(data.memo_type) || "none");
  addField("Memo", str(data.memo) || "none");
  addField("Envelope XDR", str(data.envelope_xdr), true);
  resultBox.hidden = false;
  if (hash) void loadOperations(hash, network);
}

async function loadOperations(hash: string, network: Network): Promise<void> {
  const section = document.createElement("section");
  section.className = "operations-section";
  const heading = document.createElement("h3");
  heading.className = "subheading";
  heading.textContent = "Operation breakdown";
  const body = document.createElement("div");
  body.className = "operations-list";
  const loading = document.createElement("p");
  loading.className = "empty-note";
  loading.textContent = "Loading operation details…";
  body.append(loading);
  section.append(heading, body);
  resultBox.append(section);

  try {
    const response = await fetch(
      `${HORIZON[network]}/transactions/${encodeURIComponent(hash)}/operations?limit=100&order=asc`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const page = await response.json() as HorizonPage;
    const records = page._embedded?.records ?? [];
    body.replaceChildren();
    if (!records.length) {
      const empty = document.createElement("p");
      empty.className = "empty-note";
      empty.textContent = "No operation details were returned.";
      body.append(empty);
      return;
    }
    for (const record of records) body.append(makeOperationCard(record));
  } catch {
    body.replaceChildren();
    const note = document.createElement("p");
    note.className = "empty-note";
    note.textContent = "Operation details are temporarily unavailable. The transaction summary above is still available.";
    body.append(note);
  }
}

function makeOperationCard(operation: JsonObject): HTMLElement {
  const card = document.createElement("article");
  card.className = "operation-card";
  const top = document.createElement("div");
  top.className = "operation-top";
  const title = document.createElement("strong");
  title.textContent = humanize(str(operation.type) || "operation");
  const number = document.createElement("span");
  number.className = "operation-number";
  number.textContent = `#${str(operation.id) || "—"}`;
  top.append(title, number);
  card.append(top);

  const details: Array<[string, string]> = [
    ["Source account", str(operation.source_account)],
    ["Destination", str(operation.to) || str(operation.destination)],
    ["Amount", str(operation.amount)],
    ["Asset", str(operation.asset_type) === "native" ? "XLM" : str(operation.asset_code)],
    ["Starting balance", str(operation.starting_balance)],
    ["Offer ID", str(operation.offer_id)],
    ["Trust limit", str(operation.limit)],
    ["Price", str(operation.price)],
  ];
  const grid = document.createElement("dl");
  grid.className = "operation-details";
  for (const [label, value] of details) {
    if (!value) continue;
    const item = document.createElement("div");
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    item.append(term, description);
    grid.append(item);
  }
  if (grid.childElementCount) card.append(grid);
  return card;
}

function makeResultHeading(eyebrow: string, title: string, network: Network): HTMLElement {
  const heading = document.createElement("div");
  heading.className = "result-heading";
  const text = document.createElement("div");
  const label = document.createElement("p");
  label.className = "eyebrow";
  label.textContent = eyebrow;
  const h2 = document.createElement("h2");
  h2.textContent = title;
  text.append(label, h2);
  const pill = document.createElement("span");
  pill.className = "pill";
  pill.textContent = networkLabel(network);
  heading.append(text, pill);
  return heading;
}

function addExplorerLink(container: HTMLElement, url: string, label: string): void {
  const link = document.createElement("a");
  link.className = "explorer-link";
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  link.setAttribute("aria-label", `${label} (opens in a new tab)`);
  container.append(link);
}

function explorerUrl(network: Network, kind: "account" | "tx", value: string): string {
  const networkPath = network === "public" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${networkPath}/${kind}/${encodeURIComponent(value)}`;
}

function addField(label: string, value: string, mono = false): void {
  const row = document.createElement("div");
  row.className = "field-row";
  const name = document.createElement("span");
  name.className = "field-label";
  name.textContent = label;
  const content = document.createElement("span");
  content.className = mono ? "field-value mono" : "field-value";
  content.textContent = value || "Not available";
  row.append(name, content);
  if (mono && value) row.append(makeCopyButton("Copy value", value));
  resultBox.append(row);
}

function makeCopyButton(label: string, value: string): HTMLButtonElement {
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "copy-button";
  copy.textContent = "Copy";
  copy.setAttribute("aria-label", label);
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(value);
      copy.textContent = "Copied";
      window.setTimeout(() => { copy.textContent = "Copy"; }, 1200);
    } catch {
      copy.textContent = "Unavailable";
    }
  });
  return copy;
}

function addText(text: string): void {
  const p = document.createElement("p");
  p.className = "empty-note";
  p.textContent = text;
  resultBox.append(p);
}

function showStatus(message: string, type: "loading" | "success" | "error"): void {
  statusBox.hidden = false;
  statusBox.className = `status ${type}`;
  statusBox.textContent = message;
}
function setLoading(loading: boolean): void {
  button.disabled = loading;
  button.textContent = loading ? "Inspecting…" : "Inspect ↗";
}
function networkLabel(network: Network): string {
  return network === "public" ? "Public network" : "Testnet";
}
function str(value: unknown): string {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
}
function shorten(value: string): string {
  return value.length > 22 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
}
function humanize(value: string): string {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
function formatAmount(value: string): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString(undefined, { maximumFractionDigits: 7 }) : value;
}
function formatXlmFee(stroops: string): string {
  const fee = Number(stroops) / 10_000_000;
  return Number.isFinite(fee) ? fee.toLocaleString(undefined, { maximumFractionDigits: 7 }) : "—";
}
function formatDate(value: string): string {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${date.toLocaleString()} (local time)`;
}
