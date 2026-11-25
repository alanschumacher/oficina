# AutoBox Pro — E-commerce de Peças & Agendamento para Oficina Mecânica

Implementação completa em **Next.js (App Router) + TypeScript + Tailwind CSS** preparada para deploy contínuo na **Vercel** e persistência/autenticação/storage na **Supabase**.

## O que está implementado
- **Banco de Dados & Segurança (`supabase/migrations/0001_initial_schema.sql`)**:
  - Tabelas relacionais completas (`profiles`, `vehicles`, `services`, `service_bays`, `technicians`, `appointments`, `service_orders`, `parts_catalog`, `vehicle_compatibility`, `orders`, `order_items`, `payment_webhook_events`).
  - Trava matemática anti-overbooking no PostgreSQL (`EXCLUDE USING gist` por box e por técnico).
  - RPCs atômicas `get_available_slots` (motor de capacidade) e `reserve_and_create_order` (baixa segura de estoque com `FOR UPDATE`).
  - Políticas de **Row Level Security (RLS)** e buckets de Storage (`parts-images` público e `service-evidences` privado).
- **Portal do Motorista (`/garagem` e `/agendar`)**: gestão de veículos, histórico de OS, agendamento de revisões/corretivas com upload de foto do sintoma.
- **E-commerce B2C (`/loja`)**: catálogo filtrável por compatibilidade veicular e fluxo híbrido (Entrega, Retirada ou Comprar + Instalar).
- **Painel Administrativo (`/admin`)**: KPIs de ocupação de boxes, grade diária, gestão de OS e atualização ao vivo via **Supabase Realtime**.
- **Webhooks & Cron (`/api/webhooks/payments` e `/api/cron/revision-reminders`)**: confirmação idempotente de pagamento e rotina diária na Vercel (`vercel.json`).

## Como importar na Vercel em 3 passos

1. **Suba este projeto para um repositório Git (GitHub, GitLab ou Bitbucket)**:
   ```bash
   git init
   git add .
   git commit -m "feat: sistema oficina ecommerce e agendamento"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/oficina-vercel-supabase.git
   git push -u origin main
   ```

2. **Importe na Vercel com a integração nativa da Supabase**:
   - Acesse [vercel.com/new](https://vercel.com/new) e selecione o repositório criado.
   - Na tela de configuração ou via [Vercel Marketplace — Supabase](https://vercel.com/marketplace/supabase), conecte um projeto Supabase novo ou existente: as variáveis `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` serão sincronizadas automaticamente.
   - Adicione `CRON_SECRET` e as chaves do gateway de pagamento (`MERCADOPAGO_ACCESS_TOKEN` / `MERCADOPAGO_WEBHOOK_SECRET` ou `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`) conforme `.env.example`.

3. **Aplique o esquema SQL e promova seu usuário a Admin na Supabase**:
   - No **SQL Editor** do painel da Supabase (ou via CLI `supabase db push`), execute `supabase/migrations/0001_initial_schema.sql` e depois `supabase/seed.sql`.
   - Após criar sua conta em `/login`, promova seu usuário para gestor executando no SQL Editor:
     ```sql
     update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
     where email = 'seu-email@oficina.com';
     ```
