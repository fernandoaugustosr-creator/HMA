# Sistema de Escala ENF-HMA

Este projeto é um sistema de escala de enfermagem construído com Next.js, Tailwind CSS e Supabase.

## Pré-requisitos

- Node.js instalado
- Conta no [Supabase](https://supabase.com/)
- Conta no [GitHub](https://github.com/)
- Conta na [Vercel](https://vercel.com/)

## Configuração Local

1.  **Instale as dependências:**

    ```bash
    npm install
    ```

2.  **Configure o Supabase:**

    - Crie um novo projeto no Supabase.
    - Vá para o SQL Editor e execute o conteúdo do arquivo `schema.sql` incluído neste projeto para criar as tabelas.
    - Vá para Project Settings > API e copie a `URL` e a `anon public` key.

3.  **Configure as variáveis de ambiente:**

    - Renomeie o arquivo `.env.local.example` para `.env.local`.
    - Cole suas credenciais do Supabase no arquivo:

    ```env
    NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
    NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_do_supabase
    ```

4.  **Execute o projeto:**

    ```bash
    npm run dev
    ```

    Acesse [http://localhost:3000](http://localhost:3000).

## Deploy na Vercel + GitHub

1.  **GitHub:**
    - Crie um novo repositório no GitHub.
    - Faça o push deste código para o repositório:
      ```bash
      git init
      git add .
      git commit -m "Initial commit"
      git branch -M main
      git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
      git push -u origin main
      ```

2.  **Vercel:**
    - Acesse sua conta na Vercel e clique em "Add New..." > "Project".
    - Importe o repositório do GitHub que você acabou de criar.
    - Na configuração do projeto, expanda a seção **Environment Variables**.
    - Adicione as mesmas variáveis que você configurou no `.env.local`:
      - `NEXT_PUBLIC_SUPABASE_URL`
      - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - Clique em "Deploy".

Seu sistema estará online em instantes!

## Como Atualizar o Site

O sistema está configurado com **Integração Contínua (CI/CD)**. Isso significa que a sincronização é automática:

1.  **Faça alterações no código local.**
2.  **Envie para o GitHub:**
    ```bash
    git add .
    git commit -m "Descrição da atualização"
    git push origin main
    ```
3.  **Vercel detecta e atualiza:**
    - Assim que o GitHub recebe o novo código, a Vercel inicia automaticamente um novo deploy.
    - Em 1-2 minutos, o site online é atualizado sem você precisar fazer nada lá.
