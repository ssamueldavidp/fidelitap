create or replace function public.claim_customer_card(p_unique_code text)
returns table (
  customer_card_id uuid,
  business_name    text,
  card_name        text,
  stamps_required  int,
  current_stamps   int,
  status           text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  update public.customer_cards cc
    set linked_auth_user_id = v_uid
    where cc.unique_code = p_unique_code
      and (cc.linked_auth_user_id is null or cc.linked_auth_user_id = v_uid);

  return query
    select cc.id, b.name, lc.name, lc.stamps_required, cc.current_stamps, cc.status
    from public.customer_cards cc
    join public.loyalty_cards lc on lc.id = cc.loyalty_card_id
    join public.businesses b on b.id = lc.business_id
    where cc.unique_code = p_unique_code
      and cc.linked_auth_user_id = v_uid;
end;
$$;

grant execute on function public.claim_customer_card(text) to authenticated, anon;
