export type IndustryStatus = "live" | "preview";

export type Industry = {
  id: string;
  name: string;
  tagline: string;
  status: IndustryStatus;
  href?: string;
  tickers: string[];
  focus: string;
};

/** Industry books — wired to Swarm desk-day / Robinhood tape. */
export const INDUSTRIES: Industry[] = [
  {
    id: "ai",
    name: "AI Trade",
    tagline: "Semis, power, software — the agentic AI book.",
    status: "live",
    href: "/desk?book=ai",
    tickers: ["NVDA", "AVGO", "MSFT", "VST", "AMD", "SMCI"],
    focus: "Analyze → Rank → Approve on Robinhood Agentic",
  },
  {
    id: "crypto",
    name: "Crypto",
    tagline: "Spot proxies and miners on the same Agentic rail.",
    status: "live",
    href: "/desk?book=crypto",
    tickers: ["IBIT", "ETHA", "COIN", "MARA"],
    focus: "Thesis sleeves + fluid ranking",
  },
  {
    id: "banking",
    name: "Banking",
    tagline: "Rates, credit, and money-center names.",
    status: "live",
    href: "/desk?book=banking",
    tickers: ["JPM", "BAC", "GS", "MS", "WFC", "C"],
    focus: "Hedge sleeve vs risk-on books",
  },
  {
    id: "agriculture",
    name: "Agriculture",
    tagline: "Inputs, protein, and soft commodities.",
    status: "live",
    href: "/desk?book=agriculture",
    tickers: ["ADM", "DE", "CTVA", "BG", "MOS", "TSN"],
    focus: "Seasonal + macro pack",
  },
  {
    id: "hospitality",
    name: "Hospitality",
    tagline: "Hotels, travel, and leisure demand.",
    status: "live",
    href: "/desk?book=hospitality",
    tickers: ["MAR", "HLT", "BKNG", "DAL", "ABNB", "RCL"],
    focus: "Consumer travel sleeve",
  },
  {
    id: "restaurants",
    name: "Restaurants",
    tagline: "QSR to fine dining operators.",
    status: "live",
    href: "/desk?book=restaurants",
    tickers: ["MCD", "SBUX", "CMG", "YUM", "DPZ", "WING"],
    focus: "Traffic & margin angles on Robinhood tape",
  },
  {
    id: "gig",
    name: "Gig Workers",
    tagline: "Platform labor and mobility.",
    status: "preview",
    tickers: ["UBER", "DASH", "LYFT"],
    focus: "Coming next — platform economy sleeve",
  },
];

export const DESK_BOOKS = [
  { id: "all", label: "All" },
  { id: "ai", label: "AI Trade" },
  { id: "crypto", label: "Crypto" },
  { id: "banking", label: "Banking" },
  { id: "agriculture", label: "Agriculture" },
  { id: "hospitality", label: "Hospitality" },
  { id: "restaurants", label: "Restaurants" },
] as const;

export const BRAND = {
  name: "Industry Desk",
  product: "Industry Desk",
  blurb: "Connect Robinhood once on Swarm. Pick an industry. Let an agent watch the book.",
};
