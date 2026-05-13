/**
 * Bybit V5 public spot ticker source.
 *
 * The oracle agent settles claims by fetching the resolution URL and parsing
 * its contents. The market-creator drafts price-prediction markets that point
 * at this endpoint so settlement is deterministic:
 *
 *   GET https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT
 *
 * Public, no auth needed. Returns last price, 24h volume, bid/ask, and 24h
 * change percentage.
 *
 * This module exposes two helpers:
 *   - fetchBybitTicker(symbol)        single-symbol ticker
 *   - fetchBybitSpotSummary()         human-readable summary of the top assets
 */

export const BYBIT_BASE = process.env.BYBIT_API_BASE ?? "https://api.bybit.com";

export interface BybitTicker {
  symbol:        string;
  lastPrice:     number;
  bid1Price:     number;
  ask1Price:     number;
  volume24h:     number;
  price24hPct:   number;
  highPrice24h:  number;
  lowPrice24h:   number;
  fetchedAt:     string;
  resolutionUrl: string;
}

interface BybitV5Response<T> {
  retCode: number;
  retMsg:  string;
  result:  T;
}

interface TickerListResult {
  category: string;
  list: Array<{
    symbol:           string;
    lastPrice:        string;
    indexPrice?:      string;
    markPrice?:       string;
    prevPrice24h?:    string;
    price24hPcnt?:    string;
    highPrice24h?:    string;
    lowPrice24h?:     string;
    turnover24h?:     string;
    volume24h?:       string;
    bid1Price?:       string;
    ask1Price?:       string;
  }>;
}

/** Default basket — top spot pairs we'll see in market-creator outputs. */
export const DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "MNTUSDT"];

function num(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function tickerUrl(symbol: string): string {
  return `${BYBIT_BASE}/v5/market/tickers?category=spot&symbol=${encodeURIComponent(symbol)}`;
}

async function fetchJson<T>(url: string, timeoutMs = 10_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal:  controller.signal,
      headers: { "User-Agent": "Mimir-Mantle/0.2 (Bybit-source)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch a single spot ticker. Returns null on failure. */
export async function fetchBybitTicker(symbol: string): Promise<BybitTicker | null> {
  const url = tickerUrl(symbol);
  try {
    const data = await fetchJson<BybitV5Response<TickerListResult>>(url);
    if (data.retCode !== 0 || !data.result?.list?.length) return null;
    const row = data.result.list[0];
    return {
      symbol:        row.symbol,
      lastPrice:     num(row.lastPrice),
      bid1Price:     num(row.bid1Price),
      ask1Price:     num(row.ask1Price),
      volume24h:     num(row.volume24h),
      price24hPct:   num(row.price24hPcnt) * 100,
      highPrice24h:  num(row.highPrice24h),
      lowPrice24h:   num(row.lowPrice24h),
      fetchedAt:     new Date().toISOString(),
      resolutionUrl: url,
    };
  } catch {
    return null;
  }
}

/** Human-readable summary the market-creator LLM uses to draft price markets. */
export async function fetchBybitSpotSummary(
  symbols: readonly string[] = DEFAULT_SYMBOLS,
): Promise<string> {
  const tickers = await Promise.all(symbols.map(fetchBybitTicker));
  const lines = tickers.filter(Boolean).map((t) => {
    const t2 = t as BybitTicker;
    return `${t2.symbol}: $${t2.lastPrice.toFixed(2)} ` +
           `(24h ${t2.price24hPct >= 0 ? "+" : ""}${t2.price24hPct.toFixed(2)}%, ` +
           `H $${t2.highPrice24h.toFixed(2)} / L $${t2.lowPrice24h.toFixed(2)})  ` +
           `→ ${t2.resolutionUrl}`;
  });
  if (lines.length === 0) return "(Bybit feed empty — fall back to CoinGecko)";
  return lines.join("\n");
}

/**
 * Parse a Bybit ticker response body (raw text) and return the spot price.
 * The oracle uses this when settling Bybit-sourced markets: fetch the URL,
 * call this to extract the canonical price.
 */
export function parseBybitPriceFromBody(body: string): number | null {
  try {
    const data = JSON.parse(body) as BybitV5Response<TickerListResult>;
    if (data.retCode !== 0 || !data.result?.list?.length) return null;
    return num(data.result.list[0].lastPrice);
  } catch {
    return null;
  }
}
