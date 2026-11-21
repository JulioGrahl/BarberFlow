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

// Data (dd/mm/aaaa) de um timestamptz, no fuso da barbearia.
export const tsDateBR = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

// Próximos n dias (yyyy-mm-dd) a partir de hoje, no fuso de Brasília.
export function nextDays(n: number): string[] {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  const base = Date.now();
  return Array.from({ length: n }, (_, i) => fmt.format(new Date(base + i * 864e5)));
}

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const weekdayShort = (ymd: string) =>
  ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][new Date(`${ymd}T12:00:00Z`).getUTCDay()];
export const dayMonth = (ymd: string) => ymd.slice(8, 10) + "/" + ymd.slice(5, 7);
export const timeBR = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
export const fullDateTimeBR = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "full", timeStyle: "short" });
