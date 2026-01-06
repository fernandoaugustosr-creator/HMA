# Guia de Deploy (Supabase + Vercel)

Siga estes passos para colocar seu sistema no ar.

## Passo 1: Configurar o Banco de Dados (Supabase)

1. Acesse o painel do seu projeto no Supabase: [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. No menu lateral esquerdo, clique em **SQL Editor** (ícone de terminal `>_`).
3. Clique em **+ New Query** (ou use uma existente vazia).
4. Copie **todo o conteúdo** do arquivo `supabase_schema.sql` deste projeto.
5. Cole no editor do Supabase.
6. Clique no botão **Run** (no canto inferior direito ou superior direito).
   - Isso criará todas as tabelas necessárias e configurará as permissões iniciais.

## Passo 2: Publicar na Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login com sua conta do GitHub.
2. Clique no botão **Add New...** -> **Project**.
3. Na lista "Import Git Repository", encontre o repositório **HMA** (`fernandoaugustosr-creator/HMA`) e clique em **Import**.
4. Na tela de configuração ("Configure Project"):
   - **Project Name**: Deixe como está ou mude se quiser.
   - **Framework Preset**: Deve detectar automaticamente como `Next.js`.
   - **Environment Variables** (Importante!):
     - Clique para expandir esta seção.
     - Adicione as seguintes variáveis (use os valores que estão no seu arquivo `.env.local`):
       - **Name**: `NEXT_PUBLIC_SUPABASE_URL`
       - **Value**: `Sua URL do Supabase` (ex: https://....supabase.co)
       - Clique em **Add**.
       - **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
       - **Value**: `Sua chave Anon/Public` (ex: eyJhbGc...)
       - Clique em **Add**.
5. Clique no botão **Deploy**.

Aguarde o processo terminar. Quando concluir, você receberá um link (ex: `hma.vercel.app`) onde seu sistema estará funcionando!
