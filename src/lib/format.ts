export const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Datas "YYYY-MM-DD" vindas do banco: formatadas sem passar por fuso (evita voltar um dia).
export const dateBR = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

export const dateTimeBR = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export const STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  pending: "Pendente",
  overdue: "Em atraso",
  suspended: "Suspensa",
  cancelled: "Cancelada",
};
export const STATUS_TONE: Record<string, string> = {
  active: "border-success/40 text-success",
  pending: "border-warn/40 text-warn",
  overdue: "border-danger/40 text-danger",
  suspended: "border-danger/40 text-danger",
  cancelled: "border-line text-muted",
};

export const isoDateIn = (days: number) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
