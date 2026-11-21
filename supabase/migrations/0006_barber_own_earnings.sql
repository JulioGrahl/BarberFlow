-- BarberFlow — 0006: o barbeiro lê somente as receitas dos próprios atendimentos e a própria comissão.
-- (despesas e receitas dos colegas continuam invisíveis; escrita continua só do proprietário)
create policy transactions_barber_select on public.transactions for select to authenticated
  using (type = 'income' and professional_id is not null and private.is_my_professional(professional_id));
create policy commissions_barber_select on public.professional_commissions for select to authenticated
  using (private.is_my_professional(professional_id));
