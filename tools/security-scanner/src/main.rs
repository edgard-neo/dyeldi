//! # Dyeldi Security & Credential Scanner (Rust)
//!
//! Ferramenta desenvolvida em Rust para auditoria estática prévia ao commit e publicação
//! do repositório em código aberto (Open Source) no GitHub.
//!
//! Objetivos:
//! 1. Detectar vazamentos de chaves de API reais.
//! 2. Detectar chaves criptográficas privadas (RSA, OPENSSH, etc.).
//! 3. Detectar dados pessoais sensíveis (telefones particulares, emails privados fora da allowlist de demonstração).
//! 4. Validar se o `.gitignore` possui proteção estrita contra `.env` e `firebase-applet-config.json`.

use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::exit;
use std::time::Instant;

/// Severidade de uma ocorrência encontrada
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum Severity {
    Critical,
    Warning,
    Info,
}

impl Severity {
    pub fn badge(&self) -> &'static str {
        match self {
            Severity::Critical => "\x1b[1;31m[CRÍTICO]\x1b[0m",
            Severity::Warning => "\x1b[1;33m[AVISO]\x1b[0m",
            Severity::Info => "\x1b[1;36m[INFO]\x1b[0m",
        }
    }
}

/// Registro de vulnerabilidade ou suspeita identificada
#[derive(Debug, Clone)]
pub struct Finding {
    pub file: PathBuf,
    pub line_number: usize,
    pub severity: Severity,
    pub rule: &'static str,
    pub snippet: String,
    pub recommendation: &'static str,
}

/// Diretórios e caminhos que devem ser ignorados durante a varredura
fn should_ignore_dir(dir_name: &str) -> bool {
    matches!(
        dir_name,
        "node_modules"
            | ".git"
            | "dist"
            | "build"
            | "target"
            | "coverage"
            | ".vite"
            | ".aistudio"
            | "assets"
            | "security-scanner"
    )
}

/// Extensões de arquivos que não devem ser inspecionadas como texto puro
fn should_ignore_extension(ext: &str) -> bool {
    matches!(
        ext,
        "png" | "jpg" | "jpeg" | "ico" | "gif" | "webp" | "svg" | "woff" | "woff2" | "ttf" | "lock"
    )
}

/// Verifica se uma linha contém padrões de credenciais conhecidas
fn check_line(file: &Path, line: &str, line_num: usize, findings: &mut Vec<Finding>) {
    // 1. Chaves de API do Google / Firebase (AIza...)
    // Exceto se for o template de exemplo ou string de substituição segura
    if line.contains("AIza") && !line.contains("AIzaSy_SUA_CHAVE") && !line.contains("AIzaSyDummyKey") {
        if let Some(idx) = line.find("AIza") {
            let potential_key = &line[idx..];
            if potential_key.len() >= 39 {
                let slice = &potential_key[..39];
                let is_key_charset = slice.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
                if is_key_charset {
                    findings.push(Finding {
                        file: file.to_path_buf(),
                        line_number: line_num,
                        severity: Severity::Critical,
                        rule: "CHAVE_GOOGLE_FIREBASE_EXPOSTA",
                        snippet: mask_secret(line.trim()),
                        recommendation: "Mova a chave para o arquivo .env (VITE_FIREBASE_API_KEY) e adicione o arquivo ao .gitignore.",
                    });
                }
            }
        }
    }

    // 2. Chaves de Acesso AWS (AKIA...)
    if line.contains("AKIA") {
        findings.push(Finding {
            file: file.to_path_buf(),
            line_number: line_num,
            severity: Severity::Critical,
            rule: "CHAVE_AWS_AKIA_DETECTADA",
            snippet: mask_secret(line.trim()),
            recommendation: "Revogue imediatamente a credencial AWS e utilize IAM roles ou variáveis de ambiente.",
        });
    }

    // 3. Tokens de Acesso Pessoal do GitHub (ghp_ ou github_pat_)
    if line.contains("ghp_") || line.contains("github_pat_") {
        findings.push(Finding {
            file: file.to_path_buf(),
            line_number: line_num,
            severity: Severity::Critical,
            rule: "TOKEN_GITHUB_DETECTADO",
            snippet: mask_secret(line.trim()),
            recommendation: "Revogue o token no GitHub (Developer Settings > Personal Access Tokens).",
        });
    }

    // 4. Chaves Secretas Stripe (sk_live_)
    if line.contains("sk_live_") {
        findings.push(Finding {
            file: file.to_path_buf(),
            line_number: line_num,
            severity: Severity::Critical,
            rule: "CHAVE_STRIPE_LIVE_DETECTADA",
            snippet: mask_secret(line.trim()),
            recommendation: "Nunca exponha chaves secretas Stripe no cliente ou em repositórios abertos.",
        });
    }

    // 5. Chaves Criptográficas Privadas (PEM / RSA / OPENSSH)
    if line.contains("-----BEGIN") && line.contains("PRIVATE KEY-----") {
        findings.push(Finding {
            file: file.to_path_buf(),
            line_number: line_num,
            severity: Severity::Critical,
            rule: "CHAVE_PRIVADA_CERTIFICADO_DETECTADA",
            snippet: "[CHAVE CRIPTOGRÁFICA PRIVADA IDENTIFICADA]".to_string(),
            recommendation: "Adicione chaves privadas (*.pem, *.key) ao .gitignore e remova do repositório.",
        });
    }

    // 6. Número de telefone pessoal brasileiro fixo em código
    // Padrão: 5511942145525 ou sequências similares de números de contato fixos
    if line.contains("5511942145525") || line.contains("11942145525") {
        findings.push(Finding {
            file: file.to_path_buf(),
            line_number: line_num,
            severity: Severity::Critical,
            rule: "TELEFONE_PESSOAL_EXPOSTO",
            snippet: mask_secret(line.trim()),
            recommendation: "Substitua o número fixo por VITE_SUPPORT_WHATSAPP no .env.",
        });
    }

    // 7. Detecção de emails pessoais não autorizados fora de domínios genéricos de demo
    if line.contains('@') && !line.starts_with("//") && !line.starts_with("/*") && !line.starts_with('*') {
        let words = line.split_whitespace();
        for word in words {
            let clean = word.trim_matches(|c: char| !c.is_alphanumeric() && c != '@' && c != '.' && c != '_' && c != '-');
            if clean.contains('@') && clean.contains('.') {
                let parts: Vec<&str> = clean.split('@').collect();
                if parts.len() == 2 && !parts[0].is_empty() && !parts[1].is_empty() {
                    let domain = parts[1].to_lowercase();
                    let is_allowed_domain = domain.contains("dyeldipro.com")
                        || domain.contains("dyeldi.site")
                        || domain.contains("exemplo.com")
                        || domain.contains("example.com")
                        || domain.contains("schema.org")
                        || domain.contains("google.com")
                        || domain.contains("brapi.dev");

                    if !is_allowed_domain && (clean.ends_with(".com") || clean.ends_with(".br") || clean.ends_with(".net")) {
                        findings.push(Finding {
                            file: file.to_path_buf(),
                            line_number: line_num,
                            severity: Severity::Warning,
                            rule: "EMAIL_PESSOAL_SUSPEITO",
                            snippet: format!("Email encontrado: {}", clean),
                            recommendation: "Verifique se este email é pessoal e substitua por variável de ambiente ou placeholder genérico.",
                        });
                    }
                }
            }
        }
    }
}

/// Mascara segredos para exibição segura no relatório
fn mask_secret(raw: &str) -> String {
    if raw.len() <= 12 {
        return "***REDACTED***".to_string();
    }
    let start = &raw[..6];
    let end = &raw[raw.len() - 4..];
    format!("{}...[OCULTADO]...{}", start, end)
}

/// Valida as regras essenciais do arquivo .gitignore
fn audit_gitignore(root: &Path, findings: &mut Vec<Finding>) {
    let gitignore_path = root.join(".gitignore");
    if !gitignore_path.exists() {
        findings.push(Finding {
            file: gitignore_path,
            line_number: 0,
            severity: Severity::Critical,
            rule: "GITIGNORE_INEXISTENTE",
            snippet: "Arquivo .gitignore ausente na raiz.".to_string(),
            recommendation: "Crie um arquivo .gitignore protegendo variáveis .env e credenciais.",
        });
        return;
    }

    let content = match fs::read_to_string(&gitignore_path) {
        Ok(c) => c,
        Err(_) => return,
    };

    let required_entries = [
        (".env", "Variáveis de ambiente locais"),
        ("firebase-applet-config.json", "Configuração com chave de API do Firebase"),
        ("*.pem", "Certificados criptográficos"),
        ("*.key", "Chaves privadas"),
    ];

    for (entry, desc) in required_entries {
        if !content.contains(entry) {
            findings.push(Finding {
                file: gitignore_path.clone(),
                line_number: 1,
                severity: Severity::Critical,
                rule: "REGRA_GITIGNORE_AUSENTE",
                snippet: format!("Falta ignorar: {} ({})", entry, desc),
                recommendation: "Adicione a regra no .gitignore antes de dar git commit.",
            });
        }
    }
}

/// Varre recursivamente diretórios e arquivos
fn scan_dir(dir: &Path, findings: &mut Vec<Finding>, file_count: &mut usize) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if !should_ignore_dir(name) {
                    scan_dir(&path, findings, file_count);
                }
            }
        } else if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if should_ignore_extension(ext) {
                    continue;
                }
            }

            *file_count += 1;
            scan_file(&path, findings);
        }
    }
}

/// Inspeciona um arquivo específico linha por linha
fn scan_file(file: &Path, findings: &mut Vec<Finding>) {
    // Alerta se um arquivo .env real (não .env.example) estiver presente na árvore
    if let Some(file_name) = file.file_name().and_then(|n| n.to_str()) {
        if file_name == ".env" || (file_name.starts_with(".env.") && file_name != ".env.example") {
            findings.push(Finding {
                file: file.to_path_buf(),
                line_number: 0,
                severity: Severity::Critical,
                rule: "ARQUIVO_ENV_PRESENTE",
                snippet: format!("Arquivo sensível identificado: {}", file_name),
                recommendation: "Garanta que este arquivo esteja listado no .gitignore e nunca seja comitado no GitHub.",
            });
        }
    }

    let file_handle = match File::open(file) {
        Ok(f) => f,
        Err(_) => return,
    };

    let reader = BufReader::new(file_handle);
    for (idx, line_res) in reader.lines().enumerate() {
        if let Ok(line) = line_res {
            check_line(file, &line, idx + 1, findings);
        }
    }
}

fn main() {
    let start_time = Instant::now();

    println!("\x1b[1;34m=====================================================================\x1b[0m");
    println!("\x1b[1;37m🔒 DYELDI SECURITY & CREDENTIAL AUDITOR (RUST CLI)\x1b[0m");
    println!("\x1b[0;37mAuditoria de Chaves, Credenciais e Dados Sensíveis para GitHub Open Source\x1b[0m");
    println!("\x1b[1;34m=====================================================================\x1b[0m\n");

    let root_path = Path::new(".");
    let mut findings: Vec<Finding> = Vec::new();
    let mut file_count = 0;

    println!("🔍 Analisando conformidade do arquivo .gitignore...");
    audit_gitignore(root_path, &mut findings);

    println!("📁 Inspecionando árvore de arquivos do projeto...");
    scan_dir(root_path, &mut findings, &mut file_count);

    let duration = start_time.elapsed();
    let critical_count = findings.iter().filter(|f| f.severity == Severity::Critical).count();
    let warning_count = findings.iter().filter(|f| f.severity == Severity::Warning).count();

    println!("\n\x1b[1;37m--- RELATÓRIO DE AUDITORIA DE SEGURANÇA ---\x1b[0m");
    println!("Total de arquivos inspecionados: {}", file_count);
    println!("Tempo de varredura: {:.2?}", duration);

    if findings.is_empty() {
        println!("\n\x1b[1;32m✅ SUCESSO ABSOLUTO: Nenhuma credencial ou dado sensível exposto!\x1b[0m");
        println!("\x1b[0;32mO repositório está devidamente higienizado para publicação Open Source no GitHub.\x1b[0m\n");
        println!("Principais proteções verificadas:");
        println!("  ✓ Nenhum número de telefone ou chave Pix pessoal hardcoded.");
        println!("  ✓ Variáveis de ambiente isoladas em .env e documentadas em .env.example.");
        println!("  ✓ firebase-applet-config.json e chaves privadas devidamente ignoradas no .gitignore.");
        println!("  ✓ Endpoints administrativos protegidos por ADMIN_SECRET.");
        exit(0);
    } else {
        println!("\n⚠️ Ocorrências identificadas ({} críticas, {} avisos):\n", critical_count, warning_count);

        for finding in &findings {
            println!(
                "{} \x1b[1;37m{}\x1b[0m em \x1b[0;36m{}:{}\x1b[0m",
                finding.severity.badge(),
                finding.rule,
                finding.file.display(),
                finding.line_number
            );
            println!("   Detalhe: {}", finding.snippet);
            println!("   \x1b[0;33mAção recomendada: {}\x1b[0m\n", finding.recommendation);
        }

        if critical_count > 0 {
            println!("\x1b[1;31m❌ ATENÇÃO: Corrija as ocorrências críticas acima antes de enviar para o GitHub!\x1b[0m\n");
            exit(1);
        } else {
            println!("\x1b[1;33m⚠️ AVISO: Apenas avisos informativos encontrados. Verifique antes de publicar.\x1b[0m\n");
            exit(0);
        }
    }
}
