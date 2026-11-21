import Link from "next/link";
import { CalendarCheck, Check, LineChart, MessageCircle, Smartphone, UserX, Store } from "lucide-react";
import { getUser, resolveHome } from "@/lib/auth";

const points = [
  { icon: CalendarCheck, title: "Agenda sem conflito", text: "O cliente escolhe serviço, profissional e horário livre. Dois clientes nunca pegam o mesmo horário." },
  { icon: LineChart, title: "Financeiro que fecha sozinho", text: "Cada atendimento concluído vira receita. A comissão de cada barbeiro já sai calculada." },
  { icon: MessageCircle, title: "Lembretes no WhatsApp", text: "Mensagem pronta para confirmar e lembrar, com um toque. Menos falta, menos horário perdido." },
  { icon: UserX, title: "Política de faltas", text: "Você define quantas faltas o cliente pode ter e bloqueia o agendamento online de quem abusa." },
  { icon: Smartphone, title: "Feito para o celular", text: "A tela Hoje mostra o próximo cliente, o valor do dia e o que falta fechar. Instala como app." },
  { icon: Store, title: "Página da sua barbearia", text: "Endereço próprio com serviços, horários e botão de agendar. É só colocar o link no Instagram." },
];

const steps = [
  { title: "Implantamos a sua barbearia", text: "Nossa equipe cadastra serviços, horários e preços com você." },
  { title: "Sua equipe entra por convite", text: "Cada barbeiro vê só a própria agenda e os próprios ganhos." },
  { title: "Os clientes agendam sozinhos", text: "Pelo link da página, a qualquer hora, sem ligar nem mandar mensagem." },
];

export default async function Home() {
  const user = await getUser();
  const home = user ? await resolveHome() : null;
  return (
    <div className="flex-1">
      <section className="hex-dark relative overflow-hidden bg-night text-night-ink">
        <span className="pole absolute inset-y-0 left-0 w-2.5 sm:w-3" aria-hidden />
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-10">
          <span className="font-display text-2xl">BarberFlow</span>
          {home ? <Link href={home} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover">Abrir meu painel</Link>
            : <Link href="/login" className="rounded-lg border border-night-line px-4 py-2.5 text-sm hover:bg-night-2">Entrar</Link>}
        </header>
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-20 pt-10 sm:px-10 lg:grid-cols-[1.25fr_1fr] lg:pb-28 lg:pt-16">
          <div className="rise">
            <h1 className="font-display text-[3.6rem] leading-[0.9] sm:text-[6rem] lg:text-[7.25rem]">A cadeira cheia e o caixa em dia.</h1>
            <p className="mt-7 max-w-lg text-lg text-night-muted">Agenda online, equipe, comissões e financeiro da sua barbearia em um só lugar, com a sua própria página para os clientes agendarem.</p>
            {!home ? (
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/cadastro" className="min-h-12 rounded-lg bg-accent px-6 py-3 font-semibold text-white hover:bg-accent-hover">Criar conta de cliente</Link>
                <Link href="/login" className="min-h-12 rounded-lg border border-night-line px-6 py-3 hover:bg-night-2">Já tenho conta</Link>
              </div>
            ) : null}
          </div>

          {/* A comanda: o horário marcado, exatamente como aparece para o barbeiro */}
          <div className="rise relative mx-auto mb-24 w-full max-w-sm [animation-delay:.15s]" aria-hidden>
            <div className="comanda-wrap -rotate-2">
              <div className="comanda flex text-ink">
                <div className="comanda-stub flex shrink-0 flex-col items-center justify-center bg-surface-2 py-6">
                  <span className="font-display text-4xl leading-none">14:30</span>
                  <span className="mt-1 text-xs text-muted">em 20 min</span>
                </div>
                <div className="perf my-3 w-0.5 shrink-0" />
                <div className="min-w-0 flex-1 p-5">
                  <p className="text-xs text-accent">Próximo cliente</p>
                  <p className="font-display mt-0.5 text-3xl leading-none">Rafael Lima</p>
                  <p className="mt-2 text-sm text-muted">Corte + Barba · R$ 65,00</p>
                  <div className="mt-4 flex gap-2">
                    <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-night py-2 text-sm font-medium text-white"><Check size={15} />Concluir</span>
                    <span className="inline-flex items-center rounded-lg border border-line px-3 py-2 text-sm text-muted">Faltou</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="comanda-wrap absolute -bottom-24 -right-3 w-52 rotate-3 sm:-right-8">
              <div className="rounded-2xl bg-white p-4 text-ink">
                <span className="pole absolute inset-x-4 top-0 h-1 rounded-b" />
                <p className="text-xs text-muted">Faturado hoje</p>
                <p className="font-display text-4xl leading-none">R$ 1.240</p>
                <p className="mt-1.5 text-xs text-success">9 atendidos · 3 faltam</p>
              </div>
            </div>
          </div>
        </div>
        <span className="pole absolute inset-x-0 bottom-0 h-2" aria-hidden />
      </section>

      <main>
        <section className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-10 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
            <h2 className="font-display text-5xl leading-[0.95] sm:text-6xl lg:sticky lg:top-10 lg:self-start">Tudo o que a barbearia usa no dia.</h2>
            <ul className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
              {points.map(({ icon: Icon, title, text }) => (
                <li key={title} className="border-t-2 border-ink pt-4">
                  <Icon size={24} className="text-accent" aria-hidden />
                  <h3 className="font-display mt-3 text-2xl">{title}</h3>
                  <p className="mt-1.5 text-muted">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="hex-light border-y border-line bg-surface">
          <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-10">
            <h2 className="font-display max-w-xl text-5xl leading-[0.95] sm:text-6xl">Do cadastro ao primeiro agendamento.</h2>
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title} className="rounded-2xl border border-line bg-bg p-6">
                  <span className="font-display flex size-11 items-center justify-center rounded-full bg-night text-xl text-white">{i + 1}</span>
                  <h3 className="font-display mt-5 text-2xl leading-tight">{s.title}</h3>
                  <p className="mt-2 text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-10">
          <div className="hex-dark relative overflow-hidden rounded-3xl bg-night px-7 py-12 text-night-ink sm:px-14 sm:py-16">
            <span className="pole absolute inset-x-0 top-0 h-2" aria-hidden />
            <h2 className="font-display max-w-2xl text-5xl leading-[0.95] sm:text-6xl">É dono de barbearia? Libere o seu painel.</h2>
            <p className="mt-5 max-w-xl text-night-muted">A implantação é feita pela nossa equipe. Fale com a gente e a sua barbearia entra no ar com serviços, horários e equipe já configurados.</p>
          </div>
          <p className="mt-10 text-center text-sm text-muted">BarberFlow · agendamento e gestão para barbearias</p>
        </section>
      </main>
    </div>
  );
}
