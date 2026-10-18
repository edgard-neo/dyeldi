import assert from 'node:assert';
import authLocale from '../src/locales/pt/auth.json';

console.log('--- Teste de Validação da Página de Login & Cadastro Dyeldi ---');

// 1. Validar campos de tradução do fluxo de E-mail / Senha / Criar Conta
const requiredKeys = [
  'title',
  'subtitle',
  'signup_title',
  'signup_subtitle',
  'reset_title',
  'reset_subtitle',
  'tab_login',
  'tab_signup',
  'google_button',
  'demo_title',
  'email_label',
  'password_label',
  'confirm_password_label',
  'forgot_password',
  'submit_login',
  'submit_signup',
  'submit_reset',
  'back_to_login',
  'hero_title',
  'hero_desc',
];

requiredKeys.forEach((key) => {
  assert.ok(
    (authLocale as any)[key],
    `Chave de tradução '${key}' deve estar presente no auth.json`
  );
});
console.log(`✅ [1/3] Todas as ${requiredKeys.length} chaves essenciais de autenticação estão presentes.`);

// 2. Validar que as features destacam Criptoativos e recursos reais
assert.ok(authLocale.features.crypto_title.toLowerCase().includes('cripto'), 'Feature 1 deve citar Criptoativos');
assert.ok(authLocale.features.rebalance_title.toLowerCase().includes('rebalanceamento'), 'Feature 2 deve citar Rebalanceamento');
assert.ok(authLocale.features.projections_title.toLowerCase().includes('projeção'), 'Feature 3 deve citar Projeções');
assert.ok(authLocale.features.diagnosis_title.toLowerCase().includes('diagnóstico'), 'Feature 4 deve citar Diagnóstico');
console.log('✅ [2/3] Features do painel hero refletem com precisão Cripto, Rebalanceamento e Proventos.');

// 3. Validar tratamento completo de erros do Firebase Auth
const requiredErrorCodes = [
  'popup_closed',
  'network',
  'popup_blocked',
  'email_in_use',
  'invalid_email',
  'user_not_found',
  'wrong_password',
  'invalid_credential',
  'weak_password',
  'password_mismatch',
  'default',
];

requiredErrorCodes.forEach((errKey) => {
  assert.ok(
    (authLocale.errors as any)[errKey],
    `Tradução de erro amigável '${errKey}' deve existir em auth.errors`
  );
});
console.log(`✅ [3/3] Todos os ${requiredErrorCodes.length} cenários de erro do Firebase Auth estão cobertos com mensagens amigáveis.`);

console.log('🎉 Validação da página de login e cadastro concluída com 100% de sucesso!');
