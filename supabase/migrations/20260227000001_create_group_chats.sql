-- Group chats (multi-user threads) + membership + messages

create table public.group_chats (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.users(id) on delete cascade,
  name text,
  created_at timestamptz not null default now()
);

create table public.group_chat_members (
  chat_id uuid not null references public.group_chats(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create table public.group_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.group_chats(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null check (char_length(content) > 0),
  created_at timestamptz not null default now()
);

create index idx_group_chat_members_user on public.group_chat_members(user_id);
create index idx_group_chat_messages_chat_created on public.group_chat_messages(chat_id, created_at);
create index idx_group_chat_messages_user on public.group_chat_messages(user_id);

-- RLS
alter table public.group_chats enable row level security;
alter table public.group_chat_members enable row level security;
alter table public.group_chat_messages enable row level security;

-- group_chats
create policy "Group chat members can view chats"
  on public.group_chats for select
  to authenticated
  using (
    exists (
      select 1
      from public.group_chat_members m
      where m.chat_id = group_chats.id
        and m.user_id = auth.uid()
    )
  );

create policy "Authenticated users can create chats"
  on public.group_chats for insert
  to authenticated
  with check (created_by = auth.uid());

-- group_chat_members
create policy "Group chat members can view membership"
  on public.group_chat_members for select
  to authenticated
  using (
    exists (
      select 1
      from public.group_chat_members m
      where m.chat_id = group_chat_members.chat_id
        and m.user_id = auth.uid()
    )
  );

-- Creator can add members (covers initial creation flow)
create policy "Chat creator can add members"
  on public.group_chat_members for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.group_chats c
      where c.id = group_chat_members.chat_id
        and c.created_by = auth.uid()
    )
  );

-- group_chat_messages
create policy "Group chat members can view messages"
  on public.group_chat_messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.group_chat_members m
      where m.chat_id = group_chat_messages.chat_id
        and m.user_id = auth.uid()
    )
  );

create policy "Group chat members can send messages"
  on public.group_chat_messages for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.group_chat_members m
      where m.chat_id = group_chat_messages.chat_id
        and m.user_id = auth.uid()
    )
  );

