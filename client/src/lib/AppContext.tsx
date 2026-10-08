import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, getUserId, setUserId } from "./api";
import type { Brand, Product, User, WalletSnapshot } from "../types";

interface Catalog {
  users: User[];
  brands: Brand[];
  products: Product[];
  membership: { demoDiscountPercent: number; note: string };
}

interface Ctx {
  catalog: Catalog | null;
  wallet: WalletSnapshot | null;
  userId: string;
  setUser: (id: string) => void;
  refresh: () => Promise<void>;
  brandName: (id: string | null) => string;
}

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [userId, setUid] = useState(getUserId());

  async function refresh() {
    const [c, w] = await Promise.all([api.catalog() as Promise<Catalog>, api.wallet() as Promise<WalletSnapshot>]);
    setCatalog(c);
    setWallet(w);
  }

  useEffect(() => {
    refresh().catch(() => undefined);
    const t = setInterval(() => {
      api.wallet().then((w) => setWallet(w as WalletSnapshot)).catch(() => undefined);
    }, 2000);
    return () => clearInterval(t);
  }, [userId]);

  const value = useMemo<Ctx>(
    () => ({
      catalog,
      wallet,
      userId,
      setUser: (id) => {
        setUserId(id);
        setUid(id);
      },
      refresh,
      brandName: (id) => catalog?.brands.find((b) => b.id === id)?.name ?? "—",
    }),
    [catalog, wallet, userId],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp");
  return ctx;
}
