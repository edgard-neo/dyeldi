import { db, handleFirestoreError, OperationType } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { InvestmentInputs } from '../types';

/**
 * Fetch saved simulation inputs from Firestore for the given user
 */
export async function getUserSimulationInputs(userId: string): Promise<InvestmentInputs | null> {
  try {
    const docRef = doc(db, 'users', userId, 'settings', 'simulation');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ticker: data.ticker || 'PETR4',
        initialInvestment: typeof data.initialInvestment === 'number' ? data.initialInvestment : 5000,
        monthlyContribution: typeof data.monthlyContribution === 'number' ? data.monthlyContribution : 1000,
        expectedAppreciation: typeof data.expectedAppreciation === 'number' ? data.expectedAppreciation : 10.0,
        dividendYield: typeof data.dividendYield === 'number' ? data.dividendYield : 11.5,
        reinvestDividends: typeof data.reinvestDividends === 'boolean' ? data.reinvestDividends : true,
        years: typeof data.years === 'number' ? data.years : 10,
        ipcaAnnual: typeof data.ipcaAnnual === 'number' ? data.ipcaAnnual : 4.2,
        cdiAnnual: typeof data.cdiAnnual === 'number' ? data.cdiAnnual : 10.5,
        adjustContributionForInflation: typeof data.adjustContributionForInflation === 'boolean' ? data.adjustContributionForInflation : false,
      };
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${userId}/settings/simulation`);
  }
  return null;
}

/**
 * Save simulation inputs to Firestore for the given user
 */
export async function saveUserSimulationInputs(userId: string, inputs: InvestmentInputs): Promise<boolean> {
  try {
    const docRef = doc(db, 'users', userId, 'settings', 'simulation');
    await setDoc(docRef, {
      ...inputs,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${userId}/settings/simulation`);
    return false;
  }
}
