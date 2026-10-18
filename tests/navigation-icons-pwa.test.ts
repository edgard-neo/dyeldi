import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('--- Teste de Ícones de Navegação e Instalação PWA (Dyeldi) ---');

// 1. Validar que cada View possui seu respectivo ícone alinhado com a Sidebar
const VIEW_ICONS = [
  { file: 'src/components/views/OverviewView.tsx', expectedIcon: 'LayoutDashboard', titleSnippet: 'Visão geral' },
  { file: 'src/components/views/TransactionsView.tsx', expectedIcon: 'FileText', titleSnippet: 'Lançamentos' },
  { file: 'src/components/views/PositionsView.tsx', expectedIcon: 'TrendingUp', titleSnippet: 'Carteira' },
  { file: 'src/components/views/RebalanceView.tsx', expectedIcon: 'Scale', titleSnippet: 'Rebalancear' },
  { file: 'src/components/views/DividendsView.tsx', expectedIcon: 'PiggyBank', titleSnippet: 'Dividendos' },
  { file: 'src/components/views/DiagnosisView.tsx', expectedIcon: 'Sparkles', titleSnippet: 'Diagnóstico' },
  { file: 'src/components/views/SimulatorView.tsx', expectedIcon: 'Calculator', titleSnippet: 'Simulador de Investimentos' },
];

for (const { file, expectedIcon, titleSnippet } of VIEW_ICONS) {
  const content = fs.readFileSync(path.resolve(process.cwd(), file), 'utf-8');
  assert.ok(
    content.includes(expectedIcon),
    `[FALHA] Arquivo ${file} deve importar e renderizar o ícone ${expectedIcon}`
  );
  assert.ok(
    content.includes(titleSnippet),
    `[FALHA] Arquivo ${file} deve conter o título ${titleSnippet}`
  );
}
console.log('✅ [1/2] Todas as 7 Views possuem os ícones correspondentes da Sidebar adicionados aos títulos.');

// 2. Validar integração PWA na Sidebar, Drawer e Hook
const sidebarContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/navigation/Sidebar.tsx'), 'utf-8');
assert.ok(sidebarContent.includes('triggerInstall'), 'Sidebar deve invocar triggerInstall');
assert.ok(sidebarContent.includes('Instalar Aplicativo'), 'Sidebar deve conter botão de Instalar Aplicativo');
assert.ok(sidebarContent.includes('Apoie o Projeto'), 'Sidebar deve conter botão de Apoie o Projeto');

const drawerContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/navigation/MobileMoreDrawer.tsx'), 'utf-8');
assert.ok(drawerContent.includes('triggerInstall'), 'MobileMoreDrawer deve invocar triggerInstall');
assert.ok(drawerContent.includes('Instalar App'), 'MobileMoreDrawer deve conter botão de Instalar App');
assert.ok(drawerContent.includes('Apoie o Projeto'), 'MobileMoreDrawer deve conter botão de Apoie o Projeto');

const pwaHookContent = fs.readFileSync(path.resolve(process.cwd(), 'src/hooks/usePWAInstall.ts'), 'utf-8');
assert.ok(pwaHookContent.includes('globalDeferredPrompt'), 'usePWAInstall deve manter referência global do prompt');
assert.ok(pwaHookContent.includes('beforeinstallprompt'), 'usePWAInstall deve escutar beforeinstallprompt');

// 3. Validar SupportProjectModal
const supportModalContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/common/SupportProjectModal.tsx'), 'utf-8');
assert.ok(supportModalContent.includes('Chave Pix'), 'SupportProjectModal deve exibir chave Pix');
assert.ok(supportModalContent.includes('Copiar Pix'), 'SupportProjectModal deve conter botão de Copiar Pix');

console.log('✅ [2/3] Fluxo de download/instalação do PWA verificado na Sidebar, Drawer e Hook global.');
console.log('✅ [3/3] Botão e Modal "Apoie o Projeto" com chave Pix validados com sucesso.');
console.log('🎉 Todos os testes de Ícones, PWA e Apoie o Projeto passaram com 100% de sucesso!');
