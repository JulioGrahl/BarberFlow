import Link from "next/link";
import { ArrowRight, CalendarCheck, Check, Clock, ImageIcon, LineChart, MessageCircle, Smartphone, UserX, Store, Users } from "lucide-react";
import { getUser, resolveHome } from "@/lib/auth";

const points = [
  { icon: CalendarCheck, title: "Agenda sem conflito", text: "O cliente escolhe serviço, profissional e horário livre. Dois clientes nunca pegam o mesmo horário." },
  { icon: LineChart, title: "Financeiro que fecha sozinho", text: "Cada atendimento concluído vira receita. A comissão de cada barbeiro já sai calculada." },
  { icon: MessageCircle, title: "Lembretes no WhatsApp", text: "Mensagem pronta para confirmar e lembrar, com um toque. Menos falta, menos horário perdido." },
  { icon: UserX, title: "Política de faltas", text: "Você define quantas faltas o cliente pode ter e bloqueia o agendamento online de quem abusa." },
  { icon: Smartphone, title: "Feito para o celular", text: "A tela Hoje mostra o próximo cliente, o valor do dia e o que falta fechar. Instala como app." },
  { icon: Store, title: "Página da sua barbearia", text: "Endereço próprio com equipe, serviços, vitrine de produtos e botão de agendar. É só colocar o link no Instagram." },
];

const steps = [
  { title: "Implantamos a sua barbearia", text: "Nossa equipe cadastra serviços, horários e preços com você." },
  { title: "Sua equipe entra por convite", text: "Cada barbeiro vê só a própria agenda e os próprios ganhos." },
  { title: "Os clientes agendam sozinhos", text: "Pelo link da página, a qualquer hora, sem ligar nem mandar mensagem." },
];

const roles = [
  { who: "Dono", icon: LineChart, lines: ["Agenda de toda a equipe e financeiro do mês", "Comissão de cada barbeiro calculada sozinha", "Política de faltas e bloqueio de quem abusa", "Vitrine de produtos e fotos da equipe na página"] },
  { who: "Barbeiro", icon: Users, lines: ["Entra por convite, com a própria conta", "Vê só a própria agenda e os próprios ganhos", "Marca concluído ou falta em um toque", "Abre o WhatsApp do cliente já com a mensagem"] },
  { who: "Cliente", icon: CalendarCheck, lines: ["Escolhe serviço, profissional e horário livre", "Agenda sozinho, a qualquer hora, pelo celular", "Remarca ou cancela sem precisar ligar", "Conhece a equipe e os produtos antes de chegar"] },
];

export default async function Home() {
  const user = await getUser();
  const home = user ? await resolveHome() : null;
  return (
    <div className="flex-1">
      <section className="relative overflow-hidden bg-night text-night-ink">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-10">
          <span className="flex items-center gap-2.5 font-display text-2xl"><span className="pole h-6 w-1.5 rounded-full" aria-hidden />BarberFlow</span>
          {home ? <Link href={home} className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-night hover:bg-night-ink">Abrir meu painel</Link>
            : <Link href="/login" className="rounded-lg border border-night-line px-4 py-2.5 text-sm hover:bg-night-2">Entrar</Link>}
        </header>
        <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-6 pb-24 pt-10 sm:px-10 lg:grid-cols-[1.2fr_1fr] lg:pb-32 lg:pt-16">
          <div className="rise">
            <h1 className="font-display text-[3.4rem] leading-[0.92] sm:text-[5.5rem] lg:text-[6.5rem]">A cadeira cheia e o caixa em dia.</h1>
            <p className="mt-7 max-w-lg text-lg text-night-muted">Agenda online, equipe, comissões e financeiro da sua barbearia em um só lugar, com uma página bonita para os clientes conhecerem a equipe e agendarem.</p>
            {!home ? (
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/cadastro" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-night hover:bg-night-ink">Criar conta de cliente<ArrowRight size={17} aria-hidden /></Link>
                <Link href="/login" className="min-h-12 rounded-lg border border-night-line px-6 py-3 hover:bg-night-2">Já tenho conta</Link>
              </div>
            ) : null}
          </div>

          {/* Composição: a página pública no celular, a comanda do barbeiro e o caixa do dia */}
          <div className="rise relative mx-auto h-[31rem] w-full max-w-lg sm:h-[33rem] [animation-delay:.15s]" aria-hidden>
            <div className="absolute left-1/2 top-0 w-[15.5rem] -translate-x-1/2 overflow-hidden sm:left-0 sm:translate-x-0 rounded-[2.2rem] border-[7px] border-night-line bg-bg text-ink shadow-[0_30px_60px_rgb(0_0_0/.45)] sm:w-[16.5rem]">
              <div className="bg-night px-4 pb-5 pt-5 text-night-ink">
                <p className="text-[11px] text-night-muted">Barbearia</p>
                <p className="font-display text-3xl leading-none">Seu Zé</p>
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-night-2 px-2.5 py-1 text-[11px]"><span className="size-1.5 rounded-full bg-success" />Aberto hoje, 9h às 18h</p>
                <div className="mt-3 rounded-lg bg-white py-2 text-center text-xs font-semibold text-night">Agendar horário</div>
              </div>
              <div className="space-y-3 p-3.5">
                <div className="flex gap-2">
                  {["bg-blue", "bg-success", "bg-warn"].map((c, i) => <span key={i} className={`font-display flex size-11 items-center justify-center rounded-full text-lg text-white ${c}`}>{["Z", "J", "M"][i]}</span>)}
                  <span className="self-center text-[11px] text-muted">Equipe</span>
                </div>
                {[["Corte", "30 min", "R$ 40"], ["Barba", "30 min", "R$ 30"], ["Corte + Barba", "60 min", "R$ 65"]].map(([n, d, v]) => (
                  <div key={n} className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2">
                    <span><span className="font-display block text-base leading-none">{n}</span><span className="text-[10px] text-muted">{d}</span></span>
                    <span className="font-display text-lg">{v}</span>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-2">
                  {["Pomada", "Óleo de barba"].map((n) => <div key={n} className="rounded-lg bg-night px-2.5 pb-2 pt-8 text-night-ink"><span className="font-display text-sm leading-none">{n}</span></div>)}
                </div>
              </div>
            </div>
            <div className="comanda-wrap absolute right-0 top-28 hidden sm:block w-52 rotate-2 sm:w-56">
              <div className="rounded-2xl bg-white p-4 text-ink">
                <p className="text-xs font-medium text-blue">Próximo cliente · 14:30</p>
                <p className="font-display mt-0.5 text-2xl leading-none">Rafael Lima</p>
                <p className="mt-1.5 text-xs text-muted">Corte + Barba · R$ 65,00</p>
                <div className="mt-3 flex gap-2">
                  <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-night py-1.5 text-xs font-medium text-white"><Check size={13} />Concluir</span>
                  <span className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted">Faltou</span>
                </div>
              </div>
            </div>
            <div className="comanda-wrap absolute bottom-10 right-0 hidden sm:block w-48 -rotate-2 sm:w-52">
              <div className="rounded-2xl bg-white p-4 text-ink">
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
          <h2 className="font-display max-w-2xl text-5xl leading-[0.95] sm:text-6xl">Cada pessoa vê só o que precisa.</h2>
          <ul className="mt-12 grid gap-5 md:grid-cols-3">
            {roles.map(({ who, icon: Icon, lines }) => (
              <li key={who} className="flex flex-col rounded-3xl border border-line bg-surface p-7">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-night text-white"><Icon size={22} aria-hidden /></span>
                <h3 className="font-display mt-5 text-3xl">{who}</h3>
                <ul className="mt-4 space-y-3 text-[15px]">
                  {lines.map((l) => <li key={l} className="flex gap-2.5"><Check size={18} className="mt-0.5 shrink-0 text-success" aria-hidden /><span>{l}</span></li>)}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto grid w-full max-w-6xl gap-14 px-6 py-20 sm:px-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <h2 className="font-display text-5xl leading-[0.95] sm:text-6xl">A página que o cliente vê antes de chegar.</h2>
              <p className="mt-5 max-w-lg text-lg text-muted">Fotos da equipe, serviços com preço, horários de funcionamento e uma vitrine com os produtos do balcão. O cliente conhece a barbearia e agenda no mesmo lugar.</p>
              <ul className="mt-7 space-y-3 text-[15px]">
                <li className="flex items-center gap-3"><ImageIcon size={20} className="text-blue" aria-hidden />Foto de cada profissional</li>
                <li className="flex items-center gap-3"><Store size={20} className="text-blue" aria-hidden />Vitrine de produtos, só para exibir. Sem produtos, a seção some</li>
                <li className="flex items-center gap-3"><Clock size={20} className="text-blue" aria-hidden />Horário de hoje em destaque e pausa de almoço</li>
              </ul>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {points.map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-2xl border border-line bg-bg p-5">
                  <Icon size={22} className="text-blue" aria-hidden />
                  <h3 className="font-display mt-3 text-xl leading-tight">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-10">
          <h2 className="font-display max-w-xl text-5xl leading-[0.95] sm:text-6xl">Do cadastro ao primeiro agendamento.</h2>
          <ol className="relative mt-12 grid gap-6 md:grid-cols-3">
            <span className="absolute left-11 right-[28%] top-[1.35rem] hidden h-0.5 bg-line-strong md:block" aria-hidden />
            {steps.map((s, i) => (
              <li key={s.title} className="relative">
                <span className="font-display relative flex size-11 items-center justify-center rounded-full bg-night text-xl text-white ring-8 ring-bg">{i + 1}</span>
                <h3 className="font-display mt-5 text-2xl leading-tight">{s.title}</h3>
                <p className="mt-2 max-w-xs text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-20 sm:px-10">
          <div className="relative overflow-hidden rounded-3xl bg-night px-7 py-12 text-night-ink sm:px-14 sm:py-16">
            <h2 className="font-display max-w-2xl text-5xl leading-[0.95] sm:text-6xl">É dono de barbearia? Libere o seu painel.</h2>
            <p className="mt-5 max-w-xl text-night-muted">A implantação é feita pela nossa equipe. Fale com a gente e a sua barbearia entra no ar com serviços, horários e equipe já configurados.</p>
          </div>
          <p className="mt-10 text-center text-sm text-muted">BarberFlow · agendamento e gestão para barbearias</p>
        </section>
      </main>
    </div>
  );
}
