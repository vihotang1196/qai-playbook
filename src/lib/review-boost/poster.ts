// Poster specs for the printable "please review us" poster (Phase 8).
// One entry per RB platform (matches RB_PLATFORMS ids). Bilingual (华文+English)
// so a printed poster reads for Malaysia's mixed customer base.

export type PosterSpec = {
  id: string; // google_maps | facebook | shopee | custom
  name: { cn: string; en: string };
  primary: string; // brand accent
  primarySoft: string; // soft tint for the background wash
  star: string;
  motif: string;
};

// Q.Ai Brutalist rebrand: all platforms share the black/yellow system — the
// platform is told apart by NAME (spec.name), not colour. ink primary, white
// wash, yellow stars. motif emoji dropped (brand rule: no decorative emoji).
const SPECS: Record<string, PosterSpec> = {
  google_maps: {
    id: "google_maps",
    name: { cn: "Google 评价", en: "Google review" },
    primary: "#141414",
    primarySoft: "#ffffff",
    star: "#fed50a",
    motif: "",
  },
  facebook: {
    id: "facebook",
    name: { cn: "Facebook 评价", en: "Facebook review" },
    primary: "#141414",
    primarySoft: "#ffffff",
    star: "#fed50a",
    motif: "",
  },
  shopee: {
    id: "shopee",
    name: { cn: "Shopee 评价", en: "Shopee review" },
    primary: "#141414",
    primarySoft: "#ffffff",
    star: "#fed50a",
    motif: "",
  },
  custom: {
    id: "custom",
    name: { cn: "评价我们", en: "Review us" },
    primary: "#141414",
    primarySoft: "#ffffff",
    star: "#fed50a",
    motif: "",
  },
};

export function getPosterSpec(platformId: string | null | undefined): PosterSpec {
  return (platformId && SPECS[platformId]) || SPECS.custom;
}

export type PosterSize = {
  id: "a4" | "card" | "square";
  label: { cn: string; en: string };
  width: number; // on-screen CSS px (export upscales via pixelRatio)
  height: number;
  exportScale: number; // html-to-image pixelRatio → print-friendly PNG
};

export const POSTER_SIZES: PosterSize[] = [
  { id: "a4", label: { cn: "A4 海报", en: "A4 poster" }, width: 595, height: 842, exportScale: 4 },
  { id: "card", label: { cn: "桌面台卡", en: "Table tent" }, width: 600, height: 900, exportScale: 2 },
  { id: "square", label: { cn: "社交方形", en: "Social square" }, width: 720, height: 720, exportScale: 2 },
];
