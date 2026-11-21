import { Globe, MapPin } from "lucide-react";
import type { SocialKey } from "@/lib/social";

// Ícones simples (a biblioteca de ícones do projeto não traz logos de marcas).
const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function SocialIcon({ kind, size = 18 }: { kind: SocialKey; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true } as const;
  switch (kind) {
    case "instagram":
      return <svg {...common} {...P}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r=".8" fill="currentColor" /></svg>;
    case "facebook":
      return <svg {...common} {...P}><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8.5A.5.5 0 0 1 14 8Z" /></svg>;
    case "tiktok":
      return <svg {...common} {...P}><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" /><path d="M14 3c.4 2.6 2 4.2 5 4.4" /></svg>;
    case "youtube":
      return <svg {...common} {...P}><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="m10 9.5 5 2.5-5 2.5Z" fill="currentColor" /></svg>;
    case "maps":
      return <MapPin size={size} aria-hidden />;
    default:
      return <Globe size={size} aria-hidden />;
  }
}

export const SOCIAL_LABEL: Record<SocialKey, string> = {
  instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube", website: "Site", maps: "Como chegar",
};
