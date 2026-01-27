# Sistema de Locação de Equipamentos - Ouroguel

## Sobre o Projeto

Sistema web desenvolvido como Trabalho de Conclusão de Curso (TCC) em Interação Humano-Computador (IHC) com foco em usabilidade para pessoas idosas. Digitaliza o processo de locação de equipamentos da empresa **Ouroguel LTDA**, substituindo o sistema físico por papel.

**URL do Sistema:** [https://ouroguel-1190.web.app](https://ouroguel-1190.web.app)

## Tecnologias Utilizadas

### Frontend

- **HTML5** - Estrutura semântica
- **CSS3** - Estilos com foco em acessibilidade
- **JavaScript Vanilla** - Interatividade sem frameworks complexos

### Backend & Hospedagem

- **Firebase Firestore** - Banco de dados NoSQL
- **Firebase Hosting** - Hospedagem gratuita com HTTPS

## Como Executar Localmente

### Pré-requisitos

- Conta Google (para Firebase)
- Navegador moderno (Chrome, Firefox, Edge)

### Passos

1. Clone o repositório do [GitHub](https://github.com/GabOof/ouroguel.git)
2. Crie um projeto no [Firebase Console](https://console.firebase.google.com)
3. Configure o Firestore Database
4. Substitua a configuração em `public/js/firebase-config.js`
5. Abra `public/index.html` no navegador

## Deploy no Firebase

1. Instale Firebase CLI:

```bash
npm install -g firebase-tools
```

2. Faça login:

```bash
firebase login
```

3. Inicialize o projeto:

```bash
firebase init
```

4. Faça deploy:

```bash
firebase deploy --only hosting
```
