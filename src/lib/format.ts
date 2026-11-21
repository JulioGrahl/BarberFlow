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
  suspended: "Bloqueada",
  cancelled: "Encerrada",
};
export const STATUS_TONE: Record<string, string> = {
  active: "border-success/30 bg-success-bg text-success",
  pending: "border-warn/30 bg-warn-bg text-warn",
  overdue: "border-danger/30 bg-danger-bg text-danger",
  suspended: "border-danger/30 bg-danger-bg text-danger",
  cancelled: "border-line bg-surface-2 text-muted",
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

export const nowISO = () => new Date().toISOString();

// Datas de calendário (yyyy-mm-dd) no fuso de Brasília, n dias atrás (n=0 é hoje).
export function daysAgo(n: number): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date(Date.now() - n * 864e5));
}
// Dia (yyyy-mm-dd), dia da semana (0=dom) e hora de um instante, em Brasília (UTC-3 fixo).
export function spParts(iso: string) {
  const d = new Date(new Date(iso).getTime() - 3 * 3600e3);
  return { ymd: d.toISOString().slice(0, 10), dow: d.getUTCDay(), hour: d.getUTCHours() };
}
export const spStartISO = (ymd: string) => new Date(`${ymd}T00:00:00-03:00`).toISOString();
export const spHour = () => (new Date().getUTCHours() + 21) % 24;
export const greeting = () => { const h = spHour(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; };
export const longDate = (ymd: string) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
export const STATUS_APPT: Record<string, string> = { scheduled: "agendado", completed: "concluído", no_show: "faltou", cancelled: "cancelado" };
export const nowMs = () => Date.now();

// "em 25 min", "em 1h10", "agora", "há 12 min" — diferença em minutos entre um instante e agora.
export function relTime(iso: string): string {
  const m = Math.round((new Date(iso).getTime() - Date.now()) / 60e3);
  const t = (n: number) => (n < 60 ? `${n} min` : `${Math.floor(n / 60)}h${String(n % 60).padStart(2, "0")}`);
  if (Math.abs(m) < 1) return "agora";
  return m > 0 ? `em ${t(m)}` : `há ${t(-m)}`;
}

// Concluir/Faltou só valem depois do início do atendimento (tolerância de 15 min, igual ao banco).
export const canClose = (startsAtIso: string) => new Date(startsAtIso).getTime() <= Date.now() + 15 * 60e3;
// Próximo horário "redondo" (quarto de hora) em Brasília: { date: yyyy-mm-dd, time: HH:MM }.
export function nextQuarter() {
  const d = new Date(Math.ceil((Date.now() - 3 * 3600e3) / 900e3) * 900e3);
  const iso = d.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

// Dias entre duas datas "YYYY-MM-DD" (positivo quando b é depois de a).
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);

// "hoje", "ontem" ou "há N dias" para um timestamp (fuso de São Paulo).
export function relDay(iso: string): string {
  const n = daysBetween(spParts(iso).ymd, daysAgo(0));
  return n <= 0 ? "hoje" : n === 1 ? "ontem" : `há ${n} dias`;
}
