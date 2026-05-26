# Sistema de Locação de Equipamentos - Ouroguel

## Sobre o Projeto

Sistema web desenvolvido como Trabalho de Conclusão de Curso (TCC) em Interação Humano-Computador (IHC), com foco em usabilidade para pessoas idosas.

O projeto digitaliza o processo de locação de equipamentos da empresa **Ouroguel LTDA**, substituindo controles manuais em papel por uma aplicação web acessível, responsiva e de baixa complexidade operacional.

**URL do Sistema em Produção:**
[https://ouroguel-1190.web.app](https://ouroguel-1190.web.app)

---

## Tecnologias Utilizadas

### Frontend

- **HTML5** - Estrutura semântica das páginas
- **CSS3** - Estilização com foco em acessibilidade e usabilidade
- **JavaScript Vanilla** - Interatividade sem frameworks complexos

### Backend & Infraestrutura

- **Firebase Authentication** - Autenticação de usuários
- **Firebase Firestore** - Banco de dados NoSQL
- **Firebase Storage** - Armazenamento de arquivos, caso aplicável
- **Firebase Hosting** - Hospedagem do sistema em produção
- **Firebase Emulator Suite** - Simulação local dos serviços Firebase
- **Docker** - Ambiente local padronizado e reprodutível
- **Nginx** - Servidor web local para servir os arquivos estáticos

---

## Como Executar Localmente com Docker

Este é o modo recomendado para desenvolvimento, pois mantém o ambiente local isolado da produção.

Nesse modo, o sistema roda com:

- Site local em Nginx
- Firebase Auth Emulator
- Firestore Emulator
- Storage Emulator
- Firebase Emulator UI

Ou seja, os dados de produção **não são alterados** durante o desenvolvimento local.

---

## Pré-requisitos

Antes de executar o projeto, instale:

- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)
- [Node.js](https://nodejs.org/), recomendado versão 20 ou superior
- Firebase CLI, caso vá fazer deploy ou importar/exportar dados

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

## 2. Instalar Dependências Locais

Alguns scripts de importação/exportação usam o Firebase Admin SDK.

```bash
npm install
```

Caso o projeto ainda não tenha `package.json`, inicialize:

```bash
npm init -y
npm install firebase-admin
```

---

## 3. Conferir Arquivos de Configuração

O projeto deve possuir os seguintes arquivos na raiz:

```bash
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

## 4. Rodar o Projeto Localmente

Execute:

```bash
docker compose up --build
```

Depois acesse:

```bash
http://localhost:3000
```

Painel dos emuladores Firebase:

```bash
http://localhost:4000
```

Serviços locais:

```bash
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

Para parar e remover volumes não utilizados:

```bash
docker compose down --remove-orphans
```

---

## 6. Replicar Dados da Produção para o Ambiente Local

A replicação local é opcional, mas útil para testes mais próximos do cenário real.

O projeto pode replicar:

- Usuários do Firebase Authentication
- Documentos do Firestore
- Arquivos do Firebase Storage

Os dados replicados ficam somente no ambiente local.

---

### 6.1. Criar Pasta de Seed

```bash
mkdir -p seed
```

A pasta `seed/` deve permanecer ignorada pelo Git, pois pode conter dados reais e arquivos sensíveis.

---

### 6.2. Exportar Usuários do Firebase Auth

Faça login no Firebase CLI:

```bash
firebase login
```

Exporte os usuários:

```bash
firebase auth:export seed/auth-users.json --project ouroguel-1190 --format=json
```

Depois importe para o emulador:

```bash
node scripts/import-auth-emulator.js
```

Por padrão, os usuários importados para o ambiente local podem usar uma senha de desenvolvimento definida no script, por exemplo:

```bash
123456
```

---

### 6.3. Exportar Firestore da Produção

Para exportar os documentos da produção:

```bash
node scripts/export-firestore-prod.js
```

Isso gera o arquivo:

```bash
seed/firestore.json
```

Depois, com o emulador rodando, importe para o Firestore local:

```bash
node scripts/import-firestore-emulator.js
```

---

### 6.4. Importar Storage para o Emulador

Caso o sistema use Firebase Storage, os arquivos podem ser copiados para a pasta `seed/storage/`.

Depois execute:

```bash
node scripts/import-storage-emulator.js
```

---

### 6.5. Salvar Estado dos Emuladores

Depois de importar os dados, salve o estado local:

```bash
docker compose exec firebase-emulator firebase emulators:export /workspace/.firebase-data --force
```

Na próxima execução, os dados locais serão carregados automaticamente se o container estiver configurado com:

```bash
--import /workspace/.firebase-data
--export-on-exit /workspace/.firebase-data
```

---

## Deploy no Firebase

O deploy publica o sistema em produção.

Antes de fazer deploy, confira se você está autenticado:

```bash
firebase login
```

Confira o projeto configurado:

```bash
firebase projects:list
```

O projeto esperado é:

```bash
ouroguel-1190
```

---

## 1. Inicializar Firebase no Projeto

Caso o projeto ainda não tenha sido inicializado:

```bash
firebase init
```

Durante a configuração, selecione:

```bash
Hosting
Firestore
Storage
```

Quando perguntado sobre a pasta pública:

```bash
public
```

Quando perguntado se deseja configurar como SPA:

```bash
No
```

Quando perguntado se deseja configurar deploy automático com GitHub:

```bash
No
```

Quando perguntado se deseja sobrescrever `public/index.html`:

```bash
No
```

---

## 2. Fazer Deploy do Hosting

```bash
firebase deploy --only hosting
```

---

## 3. Fazer Deploy das Regras do Firestore

```bash
firebase deploy --only firestore:rules
```

---

## 4. Fazer Deploy das Regras do Storage

Caso o projeto utilize Firebase Storage:

```bash
firebase deploy --only storage
```

---

## 5. Deploy Completo

Para publicar hosting, regras do Firestore e Storage:

```bash
firebase deploy
```

Ou de forma explícita:

```bash
firebase deploy --only hosting,firestore:rules,storage
```

---

## Licença

Projeto acadêmico desenvolvido para fins educacionais como Trabalho de Conclusão de Curso.

```

```
