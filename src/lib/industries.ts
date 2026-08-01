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

/** Six industry books — AI is live; the rest preview until packs ship. */
export const INDUSTRIES: Industry[] = [
  {
    id: "ai",
    name: "AI Trade",
    tagline: "Semis, power, software — the agentic AI book.",
    status: "live",
    href: "/ai",
    tickers: ["NVDA", "AVGO", "MSFT", "TSM", "VST", "ANET"],
    focus: "Thesis → size → Execute on Robinhood Agentic",
  },
  {
    id: "banking",
    name: "Banking",
    tagline: "Rates, credit, and money-center names.",
    status: "preview",
    tickers: ["JPM", "BAC", "GS", "MS"],
    focus: "Coming next — hedge sleeve vs risk-on books",
  },
  {
    id: "agriculture",
    name: "Agriculture",
    tagline: "Inputs, protein, and soft commodities.",
    status: "preview",
    tickers: ["DE", "ADM", "CTVA"],
    focus: "Coming next — seasonal + macro pack",
  },
  {
    id: "hospitality",
    name: "Hospitality",
    tagline: "Hotels, travel, and leisure demand.",
    status: "preview",
    tickers: ["MAR", "HLT", "BKNG"],
    focus: "Coming next — consumer travel sleeve",
  },
  {
    id: "restaurants",
    name: "Restaurants",
    tagline: "QSR to fine dining operators.",
    status: "preview",
    tickers: ["MCD", "SBUX", "CMG"],
    focus: "Coming next — traffic & margin angles",
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

export const BRAND = {
  name: "Industry Desk",
  product: "Industry Desk",
  blurb: "Connect Robinhood. Pick an industry. Let an agent watch the book.",
};
