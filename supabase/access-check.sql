-- Read permissions, hidden drafts and rejected writes. All test rows roll back.
begin;
insert into public.lagrada_players (id,display_order,profile,published)
values ('lagrada-access-test',2147483647,'{"id":"lagrada-access-test","name":"Draft test"}',false);
insert into public.lagrada_stories (id,display_order,story,published)
values ('lagrada-access-test',2147483647,'{"id":"lagrada-access-test","title":"Draft test"}',false);

set local role anon;
do $$
begin
  if exists(select 1 from public.lagrada_players where id='lagrada-access-test')
     or exists(select 1 from public.lagrada_stories where id='lagrada-access-test') then
    raise exception 'Draft content leaked';
  end if;
  if not exists(select 1 from public.lagrada_players where id='messi')
     or not exists(select 1 from public.lagrada_stories where id='messi-fifty') then
    raise exception 'Published content inaccessible';
  end if;
  begin
    update public.lagrada_players set published=false where id='messi';
    raise exception 'Anonymous update unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.lagrada_stories where id='messi-fifty';
    raise exception 'Anonymous delete unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.lagrada_stories (id,display_order,story) values ('unauthorized',2147483646,'{"id":"unauthorized","title":"Forbidden"}');
    raise exception 'Anonymous insert unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;
select current_user as tested_role, count(*) as visible_players from public.lagrada_players;

reset role;
set local role authenticated;
do $$
begin
  if exists(select 1 from public.lagrada_players where id='lagrada-access-test')
     or exists(select 1 from public.lagrada_stories where id='lagrada-access-test') then
    raise exception 'Draft content leaked to authenticated role';
  end if;
  if not exists(select 1 from public.lagrada_players where id='messi') then
    raise exception 'Published content inaccessible to authenticated role';
  end if;
  if has_table_privilege(current_user,'public.lagrada_players','INSERT')
     or has_table_privilege(current_user,'public.lagrada_players','UPDATE')
     or has_table_privilege(current_user,'public.lagrada_players','DELETE')
     or has_table_privilege(current_user,'public.lagrada_stories','INSERT')
     or has_table_privilege(current_user,'public.lagrada_stories','UPDATE')
     or has_table_privilege(current_user,'public.lagrada_stories','DELETE') then
    raise exception 'Authenticated browser role can edit content';
  end if;
end $$;
select current_user as tested_role, count(*) as visible_stories from public.lagrada_stories;
rollback;
