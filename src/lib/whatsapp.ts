// Só links wa.me: nenhuma mensagem sai sozinha. O dono clica, o WhatsApp abre com o texto pronto e ele envia.
export function waLink(phone: string | null | undefined, text: string): string | null {
  let d = (phone ?? "").replace(/\D/g, "");
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (!/^55\d{10,11}$/.test(d)) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

export type MsgKind = "confirmation" | "reminder";

export function buildMessage(kind: MsgKind, p: { customer: string; shop: string; service: string; pro: string; when: string }): string {
  const first = p.customer.trim().split(/\s+/)[0] || "";
  const head = kind === "confirmation" ? "seu horário está confirmado" : "passando para lembrar do seu horário";
  return `Olá, ${first}! ${head[0].toUpperCase()}${head.slice(1)} na ${p.shop}: ${p.service} com ${p.pro}, ${p.when}. Se precisar remarcar ou cancelar, é só responder esta mensagem.`;
}
