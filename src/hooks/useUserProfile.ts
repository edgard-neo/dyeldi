import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { doc, onSnapshot, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type InvestorProfileType = 'ALL' | 'STOCKS' | 'FIIS' | 'CRYPTO';

export interface ClassAllocations {
  stocks: number;
  fiis: number;
  crypto: number;
}

export interface UserProfile {
  investorProfile: InvestorProfileType;
  bazinHurdleRate: number;
  classAllocations: ClassAllocations;
  email?: string;
  displayName?: string;
  createdAt?: string;
  globalFeeType?: 'fixed' | 'percent';
  globalFeeValue?: string;
  preferredLayout?: 'CARDS' | 'TABLE';
}

const LOCAL_STORAGE_KEY = 'dyeldi_investor_profile';
const BAZIN_RATE_KEY = 'dyeldi_bazin_hurdle_rate';
const CLASS_ALLOCATIONS_KEY = 'dyeldi_class_allocations';

const getLocalInvestorProfile = (): InvestorProfileType => {
  try {
    const val = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (val === 'STOCKS' || val === 'FIIS' || val === 'CRYPTO' || val === 'ALL') {
      return val;
    }
  } catch (err) {
    console.warn('Erro ao ler perfil de investidor do localStorage:', err);
  }
  return 'ALL';
};

const getLocalBazinHurdleRate = (): number => {
  try {
    const val = localStorage.getItem(BAZIN_RATE_KEY);
    if (val) {
      const num = parseFloat(val);
      if (!isNaN(num) && num > 0) return num;
    }
  } catch {
    // fallback
  }
  return 0.06;
};

const getLocalClassAllocations = (): ClassAllocations => {
  try {
    const val = localStorage.getItem(CLASS_ALLOCATIONS_KEY);
    if (val) {
      const parsed = JSON.parse(val);
      if (
        typeof parsed?.stocks === 'number' &&
        typeof parsed?.fiis === 'number' &&
        typeof parsed?.crypto === 'number'
      ) {
        return {
          stocks: Math.max(0, Math.min(100, parsed.stocks)),
          fiis: Math.max(0, Math.min(100, parsed.fiis)),
          crypto: Math.max(0, Math.min(100, parsed.crypto)),
        };
      }
    }
  } catch {
    // fallback
  }
  return { stocks: 50, fiis: 20, crypto: 30 };
};

const getLocalGlobalFeeType = (): 'fixed' | 'percent' => {
  try {
    const val = localStorage.getItem('dyeldi_global_fee_type');
    return val === 'percent' ? 'percent' : 'fixed';
  } catch {
    return 'fixed';
  }
};

const getLocalGlobalFeeValue = (): string => {
  try {
    const val = localStorage.getItem('dyeldi_global_fee_value');
    return val || '0.00';
  } catch {
    return '0.00';
  }
};

const getLocalPreferredLayout = (): 'CARDS' | 'TABLE' => {
  try {
    const val = localStorage.getItem('dyeldi_preferred_layout');
    return val === 'TABLE' ? 'TABLE' : 'CARDS';
  } catch {
    return 'CARDS';
  }
};

const EMPTY_PROFILE: UserProfile = {
  investorProfile: 'ALL',
  bazinHurdleRate: 0.06,
  classAllocations: { stocks: 50, fiis: 20, crypto: 30 },
  globalFeeType: 'fixed',
  globalFeeValue: '0.00',
  preferredLayout: 'CARDS',
};

export function useUserProfile(user: User | null) {
  const [profile, setProfile] = useState<UserProfile>(() => ({
    ...EMPTY_PROFILE,
    investorProfile: getLocalInvestorProfile(),
    bazinHurdleRate: getLocalBazinHurdleRate(),
    classAllocations: getLocalClassAllocations(),
    globalFeeType: getLocalGlobalFeeType(),
    globalFeeValue: getLocalGlobalFeeValue(),
    preferredLayout: getLocalPreferredLayout(),
  }));
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    // Guest / demo: sem Firestore, usa localStorage
    if (!user || user.uid === 'demo_user' || user.uid === 'guest_user') {
      setProfile((prev) => ({
        ...prev,
        investorProfile: getLocalInvestorProfile(),
        bazinHurdleRate: getLocalBazinHurdleRate(),
        classAllocations: getLocalClassAllocations(),
        globalFeeType: getLocalGlobalFeeType(),
        globalFeeValue: getLocalGlobalFeeValue(),
        preferredLayout: getLocalPreferredLayout(),
      }));
      setLoadingProfile(false);
      return;
    }

    let isMounted = true;
    setLoadingProfile(true);

    const userDocRef = doc(db, 'users', user.uid);

    // Garante que o documento do usuário exista
    const initUserDoc = async () => {
      try {
        const snap = await getDoc(userDocRef);
        const nowIso = new Date().toISOString();

        if (!snap.exists()) {
          const defaultLocalProf = getLocalInvestorProfile();
          const defaultBazinRate = getLocalBazinHurdleRate();
          const defaultClassAllocations = getLocalClassAllocations();
          const defaultFeeType = getLocalGlobalFeeType();
          const defaultFeeVal = getLocalGlobalFeeValue();
          const defaultLayout = getLocalPreferredLayout();
          await setDoc(userDocRef, {
            email: (user.email || '').toLowerCase().trim(),
            displayName: user.displayName || '',
            investorProfile: defaultLocalProf,
            bazinHurdleRate: defaultBazinRate,
            classAllocations: defaultClassAllocations,
            globalFeeType: defaultFeeType,
            globalFeeValue: defaultFeeVal,
            preferredLayout: defaultLayout,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
          return;
        }

        // Documento existe: atualiza email/nome se mudaram
        const existingData = snap.data();
        const emailVal = (
          user.email ||
          existingData.email ||
          ''
        ).toLowerCase().trim();
        const nameVal = user.displayName || existingData.displayName || '';

        const emailChanged = emailVal !== existingData.email;
        const nameChanged = nameVal && nameVal !== existingData.displayName;

        if (emailChanged || nameChanged) {
          await setDoc(
            userDocRef,
            {
              email: emailVal,
              displayName: nameVal,
              updatedAt: nowIso,
            },
            { merge: true }
          );
        }
      } catch (err) {
        console.warn('[UserProfile] Warning during user initialization:', err);
      }
    };

    initUserDoc();

    const unsubscribe = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (!isMounted) return;

        if (docSnap.exists()) {
          const data = docSnap.data();
          const invProf: InvestorProfileType =
            data.investorProfile === 'STOCKS' ||
            data.investorProfile === 'FIIS' ||
            data.investorProfile === 'CRYPTO' ||
            data.investorProfile === 'ALL'
              ? data.investorProfile
              : getLocalInvestorProfile();

          const bazinRate: number =
            typeof data.bazinHurdleRate === 'number' && data.bazinHurdleRate > 0
              ? data.bazinHurdleRate
              : getLocalBazinHurdleRate();

          const classAlloc: ClassAllocations =
            data.classAllocations &&
            typeof data.classAllocations.stocks === 'number' &&
            typeof data.classAllocations.fiis === 'number' &&
            typeof data.classAllocations.crypto === 'number'
              ? {
                  stocks: data.classAllocations.stocks,
                  fiis: data.classAllocations.fiis,
                  crypto: data.classAllocations.crypto,
                }
              : getLocalClassAllocations();

          const feeType: 'fixed' | 'percent' =
            data.globalFeeType === 'percent' ? 'percent' : 'fixed';
          const feeValue: string =
            data.globalFeeValue !== undefined ? String(data.globalFeeValue) : getLocalGlobalFeeValue();
          const prefLayout: 'CARDS' | 'TABLE' =
            data.preferredLayout === 'TABLE' ? 'TABLE' : 'CARDS';

          setProfile({
            investorProfile: invProf,
            bazinHurdleRate: bazinRate,
            classAllocations: classAlloc,
            email: data.email || user.email || '',
            displayName: data.displayName || user.displayName || '',
            createdAt: data.createdAt || '',
            globalFeeType: feeType,
            globalFeeValue: feeValue,
            preferredLayout: prefLayout,
          });

          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, invProf);
            localStorage.setItem(BAZIN_RATE_KEY, bazinRate.toString());
            localStorage.setItem(CLASS_ALLOCATIONS_KEY, JSON.stringify(classAlloc));
            localStorage.setItem('dyeldi_global_fee_type', feeType);
            localStorage.setItem('dyeldi_global_fee_value', feeValue);
            localStorage.setItem('dyeldi_preferred_layout', prefLayout);
          } catch (e) {
            // ignore
          }
        } else {
          setProfile({
            ...EMPTY_PROFILE,
            investorProfile: getLocalInvestorProfile(),
            bazinHurdleRate: getLocalBazinHurdleRate(),
            classAllocations: getLocalClassAllocations(),
            preferredLayout: getLocalPreferredLayout(),
          });
        }
        setLoadingProfile(false);
      },
      (err) => {
        console.warn('[UserProfile] Warning listening to user profile:', err);
        if (!isMounted) return;
        setProfile({
          ...EMPTY_PROFILE,
          investorProfile: getLocalInvestorProfile(),
          bazinHurdleRate: getLocalBazinHurdleRate(),
          classAllocations: getLocalClassAllocations(),
          preferredLayout: getLocalPreferredLayout(),
        });
        setLoadingProfile(false);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [user]);

  const updateInvestorProfile = useCallback(
    async (newProfile: InvestorProfileType) => {
      setProfile((prev) => ({ ...prev, investorProfile: newProfile }));
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, newProfile);
      } catch (e) {
        console.warn('Erro ao salvar no localStorage:', e);
      }

      if (user && user.uid !== 'demo_user' && user.uid !== 'guest_user') {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(
            userDocRef,
            {
              investorProfile: newProfile,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (err) {
          console.error('Erro ao salvar perfil de investidor no Firestore:', err);
        }
      }
    },
    [user]
  );

  const updateBazinHurdleRate = useCallback(
    async (newRate: number) => {
      setProfile((prev) => ({ ...prev, bazinHurdleRate: newRate }));
      try {
        localStorage.setItem(BAZIN_RATE_KEY, newRate.toString());
      } catch (e) {
        console.warn('Erro ao salvar no localStorage:', e);
      }

      if (user && user.uid !== 'demo_user' && user.uid !== 'guest_user') {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(
            userDocRef,
            {
              bazinHurdleRate: newRate,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (err) {
          console.error('Erro ao salvar taxa Bazin no Firestore:', err);
        }
      }
    },
    [user]
  );

  const updateClassAllocations = useCallback(
    async (newAllocations: ClassAllocations) => {
      setProfile((prev) => ({ ...prev, classAllocations: newAllocations }));
      try {
        localStorage.setItem(CLASS_ALLOCATIONS_KEY, JSON.stringify(newAllocations));
      } catch (e) {
        console.warn('Erro ao salvar no localStorage:', e);
      }

      if (user && user.uid !== 'demo_user' && user.uid !== 'guest_user') {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(
            userDocRef,
            {
              classAllocations: newAllocations,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (err) {
          console.error('Erro ao salvar alocação por classe no Firestore:', err);
        }
      }
    },
    [user]
  );

  const updateGlobalFees = useCallback(
    async (feeType: 'fixed' | 'percent', feeValue: string) => {
      setProfile((prev) => ({ ...prev, globalFeeType: feeType, globalFeeValue: feeValue }));
      try {
        localStorage.setItem('dyeldi_global_fee_type', feeType);
        localStorage.setItem('dyeldi_global_fee_value', feeValue);
      } catch (e) {
        console.warn('Erro ao salvar no localStorage:', e);
      }

      if (user && user.uid !== 'demo_user' && user.uid !== 'guest_user') {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(
            userDocRef,
            {
              globalFeeType: feeType,
              globalFeeValue: feeValue,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (err) {
          console.error('Erro ao salvar taxas globais no Firestore:', err);
        }
      }
    },
    [user]
  );

  const updatePreferredLayout = useCallback(
    async (newLayout: 'CARDS' | 'TABLE') => {
      setProfile((prev) => ({ ...prev, preferredLayout: newLayout }));
      try {
        localStorage.setItem('dyeldi_preferred_layout', newLayout);
      } catch (e) {
        console.warn('Erro ao salvar no localStorage:', e);
      }

      if (user && user.uid !== 'demo_user' && user.uid !== 'guest_user') {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(
            userDocRef,
            {
              preferredLayout: newLayout,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (err) {
          console.error('Erro ao salvar layout preferido no Firestore:', err);
        }
      }
    },
    [user]
  );

  return {
    ...profile,
    updateInvestorProfile,
    updateBazinHurdleRate,
    updateClassAllocations,
    updateGlobalFees,
    updatePreferredLayout,
    loadingProfile,
  };
}