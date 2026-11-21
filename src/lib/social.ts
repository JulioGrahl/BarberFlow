// Redes sociais da barbearia: aceita @usuário, usuário ou link completo e devolve sempre um link https
// do próprio site da rede (nada de javascript:, http: ou domínio trocado).
export type SocialKey = "instagram" | "facebook" | "tiktok" | "youtube" | "website" | "maps";

export const SOCIAL_FIELDS: { key: SocialKey; label: string; placeholder: string }[] = [
  { key: "instagram", label: "Instagram", placeholder: "@suabarbearia ou link do perfil" },
  { key: "facebook", label: "Facebook", placeholder: "link da página ou nome da página" },
  { key: "tiktok", label: "TikTok", placeholder: "@suabarbearia ou link do perfil" },
  { key: "youtube", label: "YouTube", placeholder: "@canal ou link do canal" },
  { key: "website", label: "Site", placeholder: "www.suabarbearia.com.br" },
  { key: "maps", label: "Localização (Google Maps)", placeholder: "link do Google Maps" },
];

const HOST: Partial<Record<SocialKey, string>> = { instagram: "instagram.com", facebook: "facebook.com", tiktok: "tiktok.com", youtube: "youtube.com" };
const BASE: Partial<Record<SocialKey, string>> = {
  instagram: "https://www.instagram.com/", facebook: "https://www.facebook.com/", tiktok: "https://www.tiktok.com/@", youtube: "https://www.youtube.com/@",
};

// "" = vazio (remove); null = inválido; string = link pronto
export function normalizeSocial(key: SocialKey, raw: string): string | null {
  const v = raw.trim();
  if (!v) return "";
  const looksLikeUrl = /^https?:\/\//i.test(v) || /^[\w-]+(\.[\w-]+)+(\/|$)/.test(v);
  if (!looksLikeUrl) {
    const base = BASE[key];
    const user = v.replace(/^@/, "");
    if (!base || !/^[\w.\-]{2,60}$/.test(user)) return null;
    return `${base}${user}`;
  }
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`); } catch { return null; }
  url.protocol = "https:";
  const host = url.hostname.replace(/^www\./, "");
  const want = HOST[key];
  if (want && host !== want && !host.endsWith(`.${want}`)) return null;
  if (key === "maps" && !/(^|\.)(google\.[a-z.]+|goo\.gl|maps\.app\.goo\.gl|waze\.com)$/.test(host)) return null;
  if (!host.includes(".")) return null;
  const out = url.toString();
  return out.length <= 500 ? out : null;
}
