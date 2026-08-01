const RAILWAY_BASE =
  process.env.INDUSTRY_DESK_RAILWAY_URL ||
  process.env.RAILWAY_CEO_URL ||
  "https://gsb-swarm-production.up.railway.app";

let _token: string | null = null;

export async function getRailwayToken(): Promise<string> {
  if (_token) return _token;
  const password =
    process.env.DASHBOARD_PASSWORD ||
    process.env.RAILWAY_OPERATOR_PASSWORD ||
    process.env.INDUSTRY_DESK_OPERATOR_PASSWORD ||
    "Erock1976";
  const res = await fetch(`${RAILWAY_BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(`Railway auth failed (${res.status})`);
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error("Railway auth returned no token");
  _token = data.token;
  return _token;
}

export async function railwayFetch(path: string, init: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers["x-gsb-token"] = token;
  return fetch(`${RAILWAY_BASE}${path}`, { ...init, headers, cache: "no-store" });
}

export async function railwayAuthed(path: string, init: RequestInit = {}) {
  let token = await getRailwayToken();
  let res = await railwayFetch(path, init, token);
  if (res.status === 401) {
    _token = null;
    token = await getRailwayToken();
    res = await railwayFetch(path, init, token);
  }
  return res;
}
