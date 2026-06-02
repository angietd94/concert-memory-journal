// useRevenueCat.ts — Phase C: RevenueCat-backed entitlement.
// Drop-in replacement for useIap.ts: exports the SAME `useIapManager` interface
// so App.tsx only changes its import path. (~70 lines vs useIap.ts's 203 — and
// this version gets server-side receipt validation, lifecycle, and entitlements
// for free via RevenueCat's backend, which useIap.ts never did.)
import { useEffect, useState, useCallback } from 'react';
import Purchases, {
  LOG_LEVEL,
  PurchasesPackage,
  CustomerInfo,
} from 'react-native-purchases';

// Public SDK key. Test Store key for Phase C; swap for the appl_ key in production.
const RC_API_KEY = 'test_WIfXLkknvvmRyNpUbUxSMDkkdRn';

// Same SKU constants App.tsx imports.
export const SUBSCRIPTION_SKUS = ['cmj.premium.monthly', 'cmj.premium.annual'];
export const LIFETIME_SKU = 'cmj.premium.lifetime';

// Map App.tsx's SKU strings to RevenueCat package types.
const SKU_TO_PACKAGE_TYPE: Record<string, string> = {
  'cmj.premium.annual': 'ANNUAL',
  'cmj.premium.monthly': 'MONTHLY',
  'cmj.premium.lifetime': 'LIFETIME',
};

type Offer = { sku: string; price: string };
let configured = false;

export function useIapManager() {
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

  // THE entitlement check — any active entitlement unlocks premium. One line.
  const applyCustomerInfo = useCallback((info: CustomerInfo) => {
    setIsPremium(Object.keys(info.entitlements.active).length > 0);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!configured) {
          Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
          Purchases.configure({ apiKey: RC_API_KEY });
          configured = true;
        }
        const offerings = await Purchases.getOfferings();
        const pkgs = offerings.current?.availablePackages ?? [];
        if (!mounted) return;
        setPackages(pkgs);
        const mapped: Offer[] = [];
        for (const [sku, type] of Object.entries(SKU_TO_PACKAGE_TYPE)) {
          const pkg = pkgs.find((p) => p.packageType === type);
          if (pkg) mapped.push({ sku, price: pkg.product.priceString });
        }
        setOffers(mapped);
        const info = await Purchases.getCustomerInfo();
        if (mounted) applyCustomerInfo(info);
      } catch (e: any) {
        if (mounted) setLastError(e?.message ?? 'Failed to load products');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const listener = (info: CustomerInfo) => applyCustomerInfo(info);
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      mounted = false;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [applyCustomerInfo]);

  const purchase = useCallback(async (sku: string) => {
    setLastError(null);
    const pkg = packages.find((p) => p.packageType === SKU_TO_PACKAGE_TYPE[sku]);
    if (!pkg) { setLastError('Product not available'); return; }
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      applyCustomerInfo(customerInfo);
    } catch (e: any) {
      if (!e?.userCancelled) setLastError(e?.message ?? 'Purchase failed');
    }
  }, [packages, applyCustomerInfo]);

  const restore = useCallback(async () => {
    setLastError(null);
    try {
      applyCustomerInfo(await Purchases.restorePurchases());
    } catch (e: any) {
      setLastError(e?.message ?? 'Restore failed');
    }
  }, [applyCustomerInfo]);

  const debug =
    `[RC] premium=${isPremium} · offers=${offers.length}` +
    (lastError ? ` · err=${lastError}` : '');

  return { offers, isPremium, loading, purchase, restore, lastError, debug };
}
