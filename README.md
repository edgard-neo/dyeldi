# Dyeldi

Plataforma aberta para consolidação de ativos, rebalanceamento por dividend yield e gestão de carteiras de investimentos (Ações da B3, Fundos Imobiliários e Criptoativos).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933.svg?style=flat-square)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg?style=flat-square)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6.svg?style=flat-square)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38b2ac.svg?style=flat-square)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth_%26_Firestore-ffca28.svg?style=flat-square)](https://firebase.google.com/)
[![Rust Audit](https://img.shields.io/badge/Security-Rust_CLI-dea584.svg?style=flat-square)](tools/security-scanner)

---

## Sumário

- [Visão Geral](#visão-geral)
- [Módulos e Recursos](#módulos-e-recursos)
- [Arquitetura Técnica](#arquitetura-técnica)
- [Requisitos de Sistema](#requisitos-de-sistema)
- [Instalação e Execução Local](#instalação-e-execução-local)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Auditoria de Segurança em Rust](#auditoria-de-segurança-em-rust)
- [Estrutura do Repositório](#estrutura-do-repositório)
- [Comandos e Scripts](#comandos-e-scripts)
- [Licença](#licença)

---

## Visão Geral

O Dyeldi é um sistema voltado para investidores e desenvolvedores que buscam autonomia na gestão de patrimônio e análise quantitativa de investimentos. A aplicação consolida dados de negociação da B3 e do mercado cripto, aplicando regras consagradas de análise fundamentalista:

- **Preço Teto de Décio Bazin**: Cálculo dinâmico do preço máximo a pagar com base na taxa mínima de atratividade (TMA) de dividendos.
- **Margem de Segurança de Benjamin Graham**: Avaliação de desconto intrínseco sobre o valor de mercado atual.
- **Sinais Técnicos de Médias Móveis**: Acompanhamento de tendências (SMA 200) e métricas on-chain (MVRV) para alocação em ativos digitais.
- **Execução Híbrida PWA**: Suporte nativo a instalação desktop e mobile, com funcionamento resiliente a oscilações de rede.

---

## Módulos e Recursos

### 1. Painel Consolidado (Overview)

- Métricas globais de patrimônio: valor total investido, saldo a valor de mercado e rentabilidade percentual ponderada.
- Distribuição setorial e alocação por classes (Ações, FIIs e Criptomoedas).
- Modo de demonstração com dados simulados para avaliação sem necessidade de autenticação prévia.

### 2. Rebalanceamento Automatizado

- Comparativo entre alocação ideal (definida pelo usuário) e alocação real.
- Motor de alocação que direciona novos aportes aos ativos com maior desconto e margem de segurança.
- Restrições para impedir compras em ativos sobrealocados ou sem margem mínima.

### 3. Projeção de Dividendos e Renda Passiva

- Cronograma anual e mapa de calor mensal de recebimento de proventos (dividendos e juros sobre capital próprio).
- Acompanhamento de Dividend Yield histórico e yield on cost individual por posição.
- Simulação de metas de renda mensal recorrente.

### 4. Monitoramento de Criptoativos

- Cobertura de mais de 60 criptomoedas através de integração com CoinGecko e Binance.
- Suporte a frações decimais de alta precisão.
- Filtros analíticos baseados em suporte técnico de longo prazo (SMA 200).

### 5. Livro de Transações

- Registro de compras, vendas, bonificações, amortizações e proventos.
- Atualização em tempo real do preço médio de aquisição.
- Paginação eficiente e filtros avançados por classe, data e ativo.

### 6. Simulador Financeiro Atuarial

- Projeção de juros compostos com aportes regulares e reinvestimento de proventos.
- Comparação de cenários frente aos índices de referência (CDI e IPCA).

---

## Arquitetura Técnica

O sistema adota uma estrutura em camadas para assegurar desacoplamento, baixa latência e segurança de dados:

```
                  +--------------------------------+
                  |         Cliente (SPA)          |
                  |  React 19, Vite, Tailwind CSS  |
                  +---------------+----------------+
                                  |
                                  v
                  +--------------------------------+
                  |     Servidor Backend (Node)    |
                  |   Express + SSR / Prerender    |
                  +---------------+----------------+
                                  |
            +---------------------+---------------------+
            |                     |                     |
            v                     v                     v
+-----------------------+ +---------------+ +-----------------------+
|  Cache L1 em Memória  | | Firestore L2  | | APIs Externas (B3/CG) |
| (Resiliência Offline) | |  (Persist.)   | | (brapi, Bolsai, SGS)  |
+-----------------------+ +---------------+ +-----------------------+
```

- **Frontend**: Single Page Application construída com React 19, TypeScript e Tailwind CSS v4. Gerenciamento de estado por hooks dedicados e componentes desacoplados.
- **Backend**: Servidor Express com rotas protegidas por allowlist, compressão gzip, rate limiting e proxy reverso para APIs externas.
- **Estratégia de Cache**:
  - _L1_: Cache local em memória RAM no processo Node.js com tempo de expiração curto (30 minutos para cotações).
  - _L2_: Cache distribuído no Firestore para cotações e proventos históricos, reduzindo o consumo de APIs terceiras.
  - _Fallback Gracioso_: Se o Firestore estiver ausente ou offline, a aplicação opera automaticamente através do cache em memória e do modo de demonstração.

---

## Requisitos de Sistema

- **Node.js**: Versão 20.0.0 ou superior (LTS recomendado).
- **Gerenciador de Pacotes**: `npm` (incluso no Node), `pnpm`, `yarn` ou `bun`.
- **Compilador Rust** _(opcional)_: Versão 1.70+ para executar o auditor estático de credenciais em `tools/security-scanner`.

---

## Instalação e Execução Local

### 1. Clonar o Repositório

```bash
git clone https://github.com/edgard-neo/dyeldi.git
cd dyeldi
```

### 2. Instalar Dependências

```bash
npm install
```

### 3. Configurar Variáveis de Ambiente

Copie o template de variáveis de ambiente:

```bash
cp .env.example .env
```

Edite o arquivo `.env` gerado. Para execução básica em ambiente local, as chaves de API externas são opcionais; a aplicação utiliza contingência em memória e dados de referência padrão.

### 4. Executar em Modo Desenvolvimento

```bash
npm run dev
```

A aplicação estará acessível em:
`http://localhost:3000`

### 5. Compilação para Produção

```bash
npm run build
npm start
```

---

## Variáveis de Ambiente

As configurações são gerenciadas através do arquivo `.env`. Nenhuma credencial privada deve ser incluída no controle de versão.

| Variável                    | Tipo   | Obrigatório | Descrição                                                                  |
| :-------------------------- | :----- | :---------: | :------------------------------------------------------------------------- |
| `PORT`                      | Número |     Não     | Porta de execução do servidor Express (padrão: `3000`).                    |
| `APP_URL`                   | String |     Sim     | URL canônica da aplicação (ex: `http://localhost:3000`).                   |
| `ADMIN_SECRET`              | String | Recomendado | Chave secreta para rotas administrativas (`/api/admin/*`, `/api/cron/*`).  |
| `BRAPI_API_KEY`             | String |  Opcional   | Token de acesso para a API brapi.dev (cotações da B3 em tempo real).       |
| `BOLSAI_API_KEY`            | String |  Opcional   | Chave de integração com Bolsai para projeções históricas de dividendos.    |
| `COINGECKO_API_KEY`         | String |  Opcional   | Chave para consultas de criptoativos sem rate limit público.               |
| `GEMINI_API_KEY`            | String |  Opcional   | Chave do Google AI Studio para diagnósticos avançados de carteira.         |
| `VITE_FIREBASE_API_KEY`     | String |  Opcional   | Chave de API Web do projeto Firebase (persistência em nuvem).              |
| `VITE_FIREBASE_PROJECT_ID`  | String |  Opcional   | Identificador único do projeto no Firebase Console.                        |
| `VITE_FIREBASE_AUTH_DOMAIN` | String |  Opcional   | Domínio de autenticação do Firebase Auth.                                  |
| `VITE_SUPPORT_PIX_KEY`      | String |  Opcional   | Chave Pix para contribuições da comunidade no modal de suporte.            |
| `VITE_SUPPORT_WHATSAPP`     | String |  Opcional   | Canal de atendimento da comunidade (formato internacional sem caracteres). |

---

## Auditoria de Segurança em Rust

Para prevenir o envio acidental de chaves privadas, segredos ou dados pessoais sensíveis para repositórios públicos, o projeto inclui uma ferramenta de análise estática escrita em Rust puro (sem dependências externas):

- **Localização**: `tools/security-scanner/`
- **Verificações Realizadas**:
  - Padrões conhecidos de chaves de API e tokens de serviços externos.
  - Certificados e chaves criptográficas privadas (`BEGIN PRIVATE KEY`).
  - Números de telefone particulares e identificadores pessoais fixos no código.
  - Validação estrita do arquivo `.gitignore` para proteção de arquivos `.env` e configurações do Firebase.

### Execução do Scanner:

```bash
cargo run --manifest-path tools/security-scanner/Cargo.toml
```

### Configuração de Pre-Commit Hook:

```bash
echo "cargo run --manifest-path tools/security-scanner/Cargo.toml || exit 1" > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

---

## Estrutura do Repositório

```
.
├── .github/
│   └── workflows/
│       └── security-audit.yml   # Pipeline CI: Auditoria em Rust e suíte de testes
├── public/                      # Manifest, Service Worker, ícones PWA e metadados
├── scripts/                     # Scripts de geração de assets e pré-renderização SSG
├── src/
│   ├── components/              # Componentes de interface modulares e atômicos
│   │   ├── navigation/          # Menus de navegação (desktop e mobile)
│   │   ├── portfolio/           # Abas de posições, dividendos e rebalanceamento
│   │   └── views/               # Telas principais da aplicação
│   ├── hooks/                   # Custom hooks de dados, cotações e lifecycle PWA
│   ├── lib/                     # Inicialização do Firebase e clientes de infraestrutura
│   ├── locales/                 # Arquivos de internacionalização (i18n)
│   ├── utils/                   # Cálculos matemáticos, Bazin, Graham e métricas
│   └── types.ts                 # Definições centrais de tipos TypeScript
├── tests/                       # Testes automatizados de negócio e integridade
├── tools/
│   └── security-scanner/        # Ferramenta CLI de auditoria de segurança em Rust
├── server.ts                    # Backend Node.js/Express, SSR e proxy de APIs
├── tsconfig.json                # Configuração do compilador TypeScript
└── vite.config.ts               # Configuração do bundler Vite
```

---

## Comandos e Scripts

| Comando         | Descrição                                                                 |
| :-------------- | :------------------------------------------------------------------------ |
| `npm run dev`   | Inicia o servidor local de desenvolvimento (Express + Vite).              |
| `npm run build` | Compila os assets estáticos, executa SSR e gera o bundle do servidor.     |
| `npm start`     | Inicia o servidor Node.js compilado em modo produção (`dist/server.cjs`). |
| `npm run lint`  | Executa a verificação estática de tipos do TypeScript (`tsc --noEmit`).   |
| `npm test`      | Executa a suíte de testes unitários e de integração.                      |
| `npm run clean` | Remove artefatos temporários e diretórios compilados (`dist/`).           |

---

## Licença

Este projeto é disponibilizado sob os termos da licença **MIT**. Para maiores informações, consulte o arquivo [LICENSE](LICENSE).
