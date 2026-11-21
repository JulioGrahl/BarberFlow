// Diagnóstico de desempenho (desligado por padrão): com BF_TIMING=1 cada chamada ao Supabase vira uma linha no terminal
// do servidor com o tempo que levou. Serve para ver quantas consultas uma página faz e quanto cada uma custa.
export const timedFetch: typeof fetch | undefined =
  process.env.BF_TIMING === "1"
    ? async (input, init) => {
        const t = performance.now();
        const res = await fetch(input, init);
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
        const what = `${init?.method ?? "GET"} ${url.pathname.replace("/rest/v1/", "db:").replace("/auth/v1/", "auth:")}${url.search ? " " + decodeURIComponent(url.search).slice(0, 60) : ""}`;
        console.log(`[sb] ${new Date().toISOString().slice(11, 23)} ${Math.round(performance.now() - t)}ms ${what}`);
        return res;
      }
    : undefined;
