import React from 'react';
import { PortfolioSummaryItem } from '../../types';
import DiagnosisTab from '../portfolio/DiagnosisTab';
import { Sparkles, ShieldCheck, Activity } from 'lucide-react';
import { InvestorProfileType } from '../../hooks/useUserProfile';

interface DiagnosisViewProps {
  userId: string;
  summaryItems: PortfolioSummaryItem[];
  totalCurrentPortfolioValue: number;
  targetPercents: Record<string, number>;
  investorProfile?: InvestorProfileType;
}

export const DiagnosisView: React.FC<DiagnosisViewProps> = ({
  userId,
  summaryItems,
  totalCurrentPortfolioValue,
  targetPercents,
  investorProfile = 'ALL',
}) => {
  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-4 sm:p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
            <span>Diagnóstico</span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Análise detalhada de diversificação, concentração setorial e margem de segurança.
          </p>
        </div>
      </div>

      {/* Main Diagnosis Engine */}
      <DiagnosisTab
        userId={userId}
        summaryItems={summaryItems}
        totalCurrentPortfolioValue={totalCurrentPortfolioValue}
        targetPercents={targetPercents}
        investorProfile={investorProfile}
      />
    </div>
  );
};

export default DiagnosisView;
