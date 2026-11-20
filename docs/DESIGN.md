# BarberFlow — Diretrizes de interface

Referências fornecidas pelo proprietário do projeto (BarberChef: painel da barbearia; Prevaylos: painel master). São inspiração de estrutura e densidade, não para cópia de marca, textos ou identidade. O BarberFlow terá logotipo, nome e paleta próprios.

## Painel da barbearia (OWNER / BARBER)
- Tema escuro grafite/preto com um acento dourado discreto.
- Linha de 4 cards de KPI no topo: faturamento, agendamentos, clientes ativos, ticket médio, cada um com variação percentual contra o mês anterior.
- Abaixo: gráfico de linha (faturamento dos últimos 30 dias, com seletor de período e tooltip), gráfico de barras (serviços mais vendidos) e lista de próximos agendamentos (hora, cliente, serviço).
- Navegação: menu lateral no desktop, conforme a especificação (a referência usa menu no topo). No celular vira barra inferior ou menu retrátil.
- Cabeçalho com sino de notificações, nome da barbearia e papel do usuário.
- Fora da primeira versão, apesar de aparecerem na referência: comanda, estoque, fidelidade e campanhas. Ficam como roadmap.

## Painel master (SUPER_ADMIN)
- Cards: total de barbearias, ativas, suspensas e receita mensal recorrente (soma das mensalidades ativas).
- Busca de barbearias, filtros por status (todas, ativas, suspensas) e botão de atualizar.
- Tabela: nome e slug, plano, status da mensalidade, valor, status do acesso, data de cadastro e ações (ver, suspender).
- Divergência deliberada: não haverá ação "excluir" na primeira versão. A saída é "cancelar" (reversível), para preservar histórico e auditoria.
- Divergência deliberada: a referência exibe um aviso "service role active". O BarberFlow não usa `service_role` no frontend. O aviso equivalente será o de **modo suporte ativo**, mostrado sempre que o Super Admin estiver dentro do ambiente de uma barbearia.

## Tokens iniciais
- Fundo `#0B0B0D`, superfície `#141417`, borda `#26262B`, texto `#EDEDED`, texto secundário `#9A9AA2`.
- Acento `#D4A63A` (dourado), sucesso `#3DBE7A`, alerta `#E0953A`, perigo `#E05555`.
- Ícones Lucide, cantos arredondados (12–16 px), números grandes e rótulos pequenos nos cards.
- Gráficos com no máximo dois tons além do dourado; sempre com rótulo acessível, nunca só cor.
