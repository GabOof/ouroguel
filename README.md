# Sistema de Locação de Equipamentos — Ouroguel

## Sobre o Projeto

Sistema web desenvolvido como Trabalho de Conclusão de Curso — TCC — na área de Interação Humano-Computador — IHC — com foco em usabilidade para pessoas idosas.

O projeto digitaliza o processo de locação de equipamentos da empresa **Ouroguel LTDA**, substituindo controles manuais em papel por uma aplicação web acessível, responsiva e de baixa complexidade operacional.

**URL do sistema em produção:**

https://gaboof.github.io/ouroguel/

---

## Tecnologias Utilizadas

### Frontend

- **HTML5** — Estrutura semântica das páginas;
- **CSS3** — Estilização com foco em acessibilidade e usabilidade;
- **JavaScript Vanilla** — Interatividade sem frameworks complexos.

### Backend, Banco de Dados e Infraestrutura

- **Firebase Authentication** — Autenticação de usuários;
- **Firebase Firestore** — Banco de dados NoSQL;
- **Firebase Storage** — Armazenamento de arquivos, quando aplicável;
- **GitHub Pages** — Hospedagem gratuita do frontend em produção;
- **GitHub Actions** — Automatização da publicação da pasta `public`;
- **Firebase Emulator Suite** — Simulação local dos serviços Firebase;
- **Docker** — Ambiente local padronizado e reprodutível;
- **Nginx** — Servidor web local para servir os arquivos estáticos.

---

# Como Executar Localmente com Docker

Este é o modo recomendado para desenvolvimento, pois mantém o ambiente local isolado da produção.

Nesse modo, o sistema utiliza:

- Site local servido pelo Nginx;
- Firebase Auth Emulator;
- Firestore Emulator;
- Storage Emulator;
- Firebase Emulator UI.

Os dados utilizados no ambiente local não alteram diretamente os dados de produção.

---

## Pré-requisitos

Antes de executar o projeto, instale:

- [Git](https://git-scm.com/);
- [Docker](https://www.docker.com/);
- [Docker Compose](https://docs.docker.com/compose/);
- [Node.js](https://nodejs.org/), versão 20 ou superior;
- Firebase CLI, caso utilize emuladores, regras ou scripts de importação e exportação.

Instale o Firebase CLI globalmente:

```bash
npm install -g firebase-tools
```

---

## 1. Clonar o Repositório

```bash
git clone https://github.com/GabOof/ouroguel.git
cd ouroguel
```

---

## 2. Instalar as Dependências Locais

Alguns scripts de importação e exportação utilizam o Firebase Admin SDK.

Execute:

```bash
npm install
```

Caso o projeto ainda não possua um arquivo `package.json`, inicialize-o:

```bash
npm init -y
npm install firebase-admin
```

---

## 3. Conferir os Arquivos de Configuração

O projeto deve possuir os seguintes arquivos na raiz:

```text
firebase.json
.firebaserc
firestore.rules
storage.rules
Dockerfile
compose.yaml
```

O arquivo `.firebaserc` deve apontar para o projeto Firebase:

```json
{
    "projects": {
        "default": "ouroguel-1190"
    }
}
```

---

## 4. Executar o Projeto Localmente

Execute:

```bash
docker compose up --build -d
```

Depois, acesse o sistema:

```text
http://localhost:3000
```

Acesse o painel dos emuladores Firebase:

```text
http://localhost:4000
```

### Serviços locais

```text
Site local:              http://localhost:3000
Firebase Emulator UI:    http://localhost:4000
Firestore Emulator:      http://localhost:8080
Auth Emulator:           http://localhost:9099
Storage Emulator:        http://localhost:9199
```

---

## 5. Parar o Ambiente Local

Para parar os containers:

```bash
docker compose down
```

Para parar os containers e remover recursos órfãos:

```bash
docker compose down --remove-orphans
```

---

# Replicação dos Dados de Produção

A replicação local é opcional, mas pode ser útil para realizar testes próximos do cenário real.

O projeto pode replicar:

- Usuários do Firebase Authentication;
- Documentos do Firestore;
- Arquivos do Firebase Storage.

Os dados replicados devem permanecer somente no ambiente local.

---

## 1. Criar a Pasta de Seed

```bash
mkdir -p seed
```

A pasta `seed/` deve permanecer ignorada pelo Git, pois pode conter dados reais ou informações sensíveis.

Exemplo de configuração no `.gitignore`:

```gitignore
seed/
serviceAccountKey.json
.firebase-data/
```

---

## 2. Exportar Usuários do Firebase Authentication

Autentique-se no Firebase CLI:

```bash
firebase login
```

Exporte os usuários:

```bash
firebase auth:export seed/auth-users.json \
    --project ouroguel-1190 \
    --format=json
```

Depois, importe os usuários para o emulador:

```bash
node scripts/import-auth-emulator.js
```

Dependendo da implementação do script, os usuários importados podem utilizar uma senha de desenvolvimento padronizada, por exemplo:

```text
123456
```

Essa senha deve ser utilizada somente no ambiente local.

---

## 3. Exportar o Firestore da Produção

Execute:

```bash
node scripts/export-firestore-prod.js
```

O script deve gerar o arquivo:

```text
seed/firestore.json
```

Com os emuladores em execução, importe os dados:

```bash
node scripts/import-firestore-emulator.js
```

---

## 4. Importar Arquivos para o Storage Emulator

Caso o sistema utilize Firebase Storage, copie os arquivos para:

```text
seed/storage/
```

Depois execute:

```bash
node scripts/import-storage-emulator.js
```

---

## 5. Salvar o Estado dos Emuladores

Depois de importar os dados, salve o estado local:

```bash
docker compose exec firebase-emulator \
    firebase emulators:export /workspace/.firebase-data --force
```

Na próxima execução, os dados locais poderão ser carregados automaticamente por meio das opções:

```text
--import /workspace/.firebase-data
--export-on-exit /workspace/.firebase-data
```

---

# Deploy Automático com GitHub Pages

O frontend do sistema é hospedado pelo **GitHub Pages**.

A hospedagem do site não utiliza mais o Firebase Hosting. O Firebase continua responsável por:

- Autenticação;
- Banco de dados Firestore;
- Armazenamento de arquivos;
- Regras de segurança.

O código completo do projeto permanece na branch `main`.

A branch `gh-pages` contém somente os arquivos da pasta `public` e é utilizada como origem de publicação do GitHub Pages.

O deploy é automatizado pelo GitHub Actions.

O fluxo de publicação é:

```text
Push na branch main
        ↓
GitHub Actions é executado
        ↓
A pasta public é separada com git subtree
        ↓
A branch gh-pages é atualizada
        ↓
GitHub Pages publica o site
```

Depois da configuração inicial, não é mais necessário executar manualmente:

```bash
git subtree split --prefix public -b gh-pages
git push -f origin gh-pages:gh-pages
git branch -D gh-pages
```

---

## 1. Conferir a Pasta Pública

O GitHub Pages publica o conteúdo da pasta:

```text
public/
```

O arquivo principal do site deve estar em:

```text
public/index.html
```

Confirme também a existência do arquivo `.nojekyll`:

```bash
touch public/.nojekyll
```

Esse arquivo evita que o GitHub Pages tente processar o projeto utilizando Jekyll.

A estrutura mínima esperada é:

```text
public/
├── css/
├── js/
├── pages/
├── index.html
└── .nojekyll
```

---

## 2. Configurar o GitHub Pages

No GitHub, acesse:

```text
Settings > Pages
```

Em **Build and deployment**, configure:

```text
Source: Deploy from a branch
Branch: gh-pages
Folder: / (root)
```

Depois clique em **Save**.

O sistema será publicado em:

```text
https://gaboof.github.io/ouroguel/
```

---

## 3. Criar um Token para o Deploy

O workflow precisa atualizar a branch `gh-pages`.

Para isso, crie um token de acesso pessoal com permissão de escrita no repositório.

No GitHub, acesse:

```text
Settings
> Developer settings
> Personal access tokens
> Fine-grained tokens
> Generate new token
```

Configure:

```text
Token name: Ouroguel Pages Deploy
Repository access: Only select repositories
Repository: ouroguel
```

Em **Repository permissions**, configure:

```text
Contents: Read and write
```

Depois de gerar o token, copie o valor apresentado.

O token é exibido apenas no momento da criação.

---

## 4. Criar o Secret do Repositório

No repositório, acesse:

```text
Settings
> Secrets and variables
> Actions
> New repository secret
```

Crie o seguinte secret:

```text
Name: PAGES_DEPLOY_TOKEN
Secret: valor do token criado anteriormente
```

O token não deve ser colocado diretamente no arquivo do workflow.

---

## 5. Criar o Workflow de Deploy

Crie a pasta de workflows, caso ainda não exista:

```bash
mkdir -p .github/workflows
```

Crie o arquivo:

```text
.github/workflows/deploy-pages.yml
```

Adicione o seguinte conteúdo:

```yaml
name: Deploy GitHub Pages

on:
    push:
        branches:
            - main

    workflow_dispatch:

permissions:
    contents: read

concurrency:
    group: deploy-gh-pages
    cancel-in-progress: true

jobs:
    deploy:
        name: Atualizar branch gh-pages
        runs-on: ubuntu-latest

        steps:
            - name: Baixar repositório
              uses: actions/checkout@v7
              with:
                  fetch-depth: 0
                  persist-credentials: false

            - name: Validar pasta pública
              shell: bash
              run: |
                  if [ ! -d "public" ]; then
                    echo "::error::A pasta public não existe."
                    exit 1
                  fi

                  if [ ! -f "public/index.html" ]; then
                    echo "::error::O arquivo public/index.html não existe."
                    exit 1
                  fi

                  if [ ! -f "public/.nojekyll" ]; then
                    echo "::error::O arquivo public/.nojekyll não existe."
                    exit 1
                  fi

            - name: Configurar Git
              shell: bash
              run: |
                  git config user.name "github-actions[bot]"
                  git config user.email \
                    "41898282+github-actions[bot]@users.noreply.github.com"

            - name: Gerar conteúdo da branch gh-pages
              id: subtree
              shell: bash
              run: |
                  SPLIT_COMMIT="$(git subtree split --prefix public)"

                  if [ -z "$SPLIT_COMMIT" ]; then
                    echo "::error::Não foi possível gerar o subtree da pasta public."
                    exit 1
                  fi

                  echo "commit=$SPLIT_COMMIT" >> "$GITHUB_OUTPUT"
                  echo "Subtree gerado no commit: $SPLIT_COMMIT"

            - name: Publicar branch gh-pages
              shell: bash
              env:
                  PAGES_DEPLOY_TOKEN: ${{ secrets.PAGES_DEPLOY_TOKEN }}
              run: |
                  if [ -z "$PAGES_DEPLOY_TOKEN" ]; then
                    echo "::error::O secret PAGES_DEPLOY_TOKEN não foi configurado."
                    exit 1
                  fi

                  git remote set-url origin \
                    "https://x-access-token:${PAGES_DEPLOY_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"

                  git push \
                    --force \
                    origin \
                    "${{ steps.subtree.outputs.commit }}:refs/heads/gh-pages"
```

Esse workflow:

1. É executado a cada `push` na branch `main`;
2. Verifica se a pasta `public` existe;
3. Verifica se existe um `index.html`;
4. Verifica se existe o arquivo `.nojekyll`;
5. Gera um commit contendo apenas a pasta `public`;
6. Atualiza automaticamente a branch `gh-pages`;
7. Aciona o processo de publicação do GitHub Pages.

---

## 6. Enviar o Workflow para o Repositório

Adicione os arquivos:

```bash
git add .github/workflows/deploy-pages.yml
git add public/.nojekyll
```

Crie o commit:

```bash
git commit -m "ci(pages): automatizar deploy pela branch gh-pages"
```

Envie para a branch `main`:

```bash
git push origin main
```

---

## 7. Acompanhar o Deploy

No GitHub, acesse:

```text
Actions
```

O primeiro workflow esperado é:

```text
Deploy GitHub Pages
```

Esse workflow atualiza a branch `gh-pages`.

Depois, o GitHub pode iniciar automaticamente um workflow interno chamado:

```text
pages-build-deployment
```

Esse segundo workflow é administrado pelo próprio GitHub e realiza a publicação final do site.

O endereço de produção é:

```text
https://gaboof.github.io/ouroguel/
```

---

## 8. Executar o Deploy Manualmente

O workflow possui a opção:

```yaml
workflow_dispatch:
```

Por isso, também pode ser executado manualmente:

```text
Actions
> Deploy GitHub Pages
> Run workflow
> main
> Run workflow
```

---

## 9. Fluxo Normal de Desenvolvimento

Depois da configuração inicial, o fluxo cotidiano é:

```bash
git add .
git commit -m "tipo(escopo): descrição da alteração"
git push origin main
```

Exemplo:

```bash
git add .
git commit -m "feat(alugueis): permitir cobrança por horas e minutos"
git push origin main
```

Depois do `push`, o GitHub Actions atualiza automaticamente a branch `gh-pages`.

---

## 10. Publicação Manual de Emergência

Caso seja necessário publicar sem utilizar o GitHub Actions, ainda é possível executar:

```bash
git subtree split --prefix public -b gh-pages
git push -f origin gh-pages:gh-pages
git branch -D gh-pages
```

Esse procedimento deve ser utilizado apenas quando o workflow automático não estiver disponível.

---

## 11. Problemas Comuns no Deploy

### Workflow não foi executado

Confirme se:

- O arquivo está dentro de `.github/workflows/`;
- O arquivo possui extensão `.yml` ou `.yaml`;
- O push foi realizado na branch `main`;
- O GitHub Actions está habilitado no repositório.

Confira localmente:

```bash
git branch --show-current
git status
git log -1 --oneline
```

---

### Secret não foi configurado

Se aparecer a mensagem:

```text
O secret PAGES_DEPLOY_TOKEN não foi configurado.
```

Acesse:

```text
Settings
> Secrets and variables
> Actions
```

Confirme se existe um secret chamado exatamente:

```text
PAGES_DEPLOY_TOKEN
```

---

### Erro de permissão ao atualizar a branch

Confirme se o token possui a permissão:

```text
Contents: Read and write
```

Confirme também se o token possui acesso ao repositório:

```text
GabOof/ouroguel
```

---

### A branch foi atualizada, mas o site não foi publicado

Confirme a configuração:

```text
Settings
> Pages
```

O esperado é:

```text
Source: Deploy from a branch
Branch: gh-pages
Folder: / (root)
```

Também verifique o workflow interno:

```text
Actions
> pages-build-deployment
```

Se esse workflow permanecer em `deployment_queued` ou `deployment_in_progress` por um período excessivo, o problema pode estar relacionado à infraestrutura do próprio GitHub Pages.

---

### Aviso sobre `punycode`

O workflow interno do GitHub pode mostrar:

```text
[DEP0040] DeprecationWarning:
The `punycode` module is deprecated.
```

Esse aviso é gerado por uma dependência interna das ações do GitHub.

Ele não indica um erro no código do projeto e, isoladamente, não impede a publicação.

---

### Site publicado, mas CSS ou JavaScript não carrega

Como o projeto é publicado em:

```text
https://gaboof.github.io/ouroguel/
```

Evite caminhos absolutos iniciados por `/`.

Exemplo que pode não funcionar:

```html
<link rel="stylesheet" href="/css/style.css" />
<script src="/js/app.js"></script>
```

Prefira caminhos relativos:

```html
<link rel="stylesheet" href="./css/style.css" />
<script src="./js/app.js"></script>
```

Em páginas dentro de subdiretórios:

```html
<link rel="stylesheet" href="../css/style.css" />
<script src="../js/app.js"></script>
```

---

### Alterações não aparecem no navegador

Primeiro, confirme se os workflows foram concluídos.

Depois, atualize a página ignorando o cache:

```text
Ctrl + Shift + R
```

Também é possível testar em uma janela anônima.

---

# Atualizar Regras do Firestore

Mesmo utilizando GitHub Pages para hospedar o frontend, as regras do Firestore continuam sendo gerenciadas pelo Firebase.

Para publicar alterações nas regras:

```bash
firebase deploy --only firestore:rules
```

---

# Atualizar Regras do Firebase Storage

Caso o sistema utilize Firebase Storage, publique as regras com:

```bash
firebase deploy --only storage
```

Para publicar as regras do Firestore e do Storage juntas:

```bash
firebase deploy --only firestore:rules,storage
```

---

# Segurança

Não envie para o GitHub:

- Chaves privadas;
- Tokens de acesso;
- Arquivos de contas de serviço;
- Dados exportados da produção;
- Senhas;
- Arquivos de seed contendo dados pessoais.

Exemplo de `.gitignore`:

```gitignore
node_modules/
seed/
serviceAccountKey.json
.firebase-data/
.env
.env.*
*.log
```

O token de publicação deve permanecer armazenado somente no secret:

```text
PAGES_DEPLOY_TOKEN
```

---

## Licença

Projeto acadêmico desenvolvido para fins educacionais como Trabalho de Conclusão de Curso.
