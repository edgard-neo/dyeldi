# Dyeldi Security & Credential Scanner (Rust)

Ferramenta CLI escrita em **Rust puro** (sem dependências externas) para auditoria estática do repositório antes de realizar commits ou publicar em código aberto no GitHub.

## 🚀 Como Executar

### 1. Execução direta com Cargo
Certifique-se de ter o Rust instalado (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`):

```bash
# Executa a varredura a partir da raiz do projeto
cargo run --manifest-path tools/security-scanner/Cargo.toml
```

### 2. Como Git Hook (Pré-Commit)
Para garantir que nenhum desenvolvedor envie credenciais acidentalmente:

Crie o arquivo `.git/hooks/pre-commit`:
```bash
#!/bin/sh
cargo run --manifest-path tools/security-scanner/Cargo.toml
if [ $? -ne 0 ]; then
    echo "Commit cancelado: segredos ou credenciais detectadas!"
    exit 1
fi
```
Torne-o executável:
```bash
chmod +x .git/hooks/pre-commit
```

## 🛡️ O que o scanner valida

- [x] Regras de proteção do `.gitignore` (`.env`, `firebase-applet-config.json`, `*.pem`, `*.key`)
- [x] Detecção de chaves de API Google / Firebase
- [x] Detecção de tokens pessoais do GitHub
- [x] Detecção de chaves de acesso AWS
- [x] Detecção de chaves secretas Stripe
- [x] Detecção de chaves criptográficas privadas
- [x] Detecção de dados pessoais sensíveis (telefones de contato ou WhatsApp particulares)
- [x] Detecção de emails pessoais fora da lista autorizada de demonstração
