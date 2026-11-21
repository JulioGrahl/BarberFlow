import Link from "next/link";
import { CalendarCheck, LineChart, MessageCircle } from "lucide-react";
import { getUser, resolveHome } from "@/lib/auth";

const points = [
  { icon: CalendarCheck, title: "Agenda sem conflito", text: "O cliente escolhe serviço, profissional e horário livre. Dois clientes nunca pegam o mesmo horário." },
  { icon: LineChart, title: "Financeiro que fecha sozinho", text: "Cada atendimento concluído vira receita; as comissões de cada barbeiro já saem calculadas." },
  { icon: MessageCircle, title: "Lembretes no WhatsApp", text: "Mensagem pronta para confirmar e lembrar, com um clique. Menos falta, menos horário perdido." },
];

export default async function Home() {
  const user = await getUser();
  const home = user ? await resolveHome() : null;
  return (
    <div className="flex-1">
      <div className="pole h-2 w-full" aria-hidden />
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <span className="font-display text-xl">BarberFlow</span>
        {home ? <Link href={home} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">Abrir meu painel</Link>
          : <Link href="/login" className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-surface">Entrar</Link>}
      </header>
      <main className="mx-auto w-full max-w-5xl px-5 pb-20 pt-14 sm:pt-24">
        <h1 className="font-display max-w-3xl text-5xl leading-[1.05] sm:text-7xl">A cadeira cheia e o caixa em dia.</h1>
        <p className="mt-6 max-w-xl text-lg text-muted">Agenda online, equipe, comissões e financeiro da sua barbearia em um só lugar, com a sua própria página para os clientes agendarem.</p>
        {!home ? (
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/cadastro" className="rounded-lg bg-accent px-6 py-3 font-semibold text-accent-ink hover:brightness-110">Criar conta de cliente</Link>
            <Link href="/login" className="rounded-lg border border-line px-6 py-3 hover:bg-surface">Já tenho conta</Link>
          </div>
        ) : null}
        <ul className="mt-20 grid gap-8 sm:grid-cols-3">
          {points.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <Icon size={22} className="text-accent" aria-hidden />
              <h2 className="font-display mt-3 text-xl">{title}</h2>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </li>
          ))}
        </ul>
        <p className="mt-16 text-sm text-muted">É dono de barbearia? A implantação é feita pela nossa equipe. Fale com a gente para liberar o seu painel.</p>
      </main>
    </div>
  );
}
