import type { ButtonHTMLAttributes, ReactNode } from "react";

export function ClubHero({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-club-orange to-club-deep px-6 pb-16 pt-10 text-white">
      <div className="pointer-events-none absolute -right-16 top-8 h-48 w-48 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -left-10 bottom-4 h-32 w-32 rounded-full bg-club-fuchsia/20" />
      <p className="text-center text-sm font-medium text-white/90">{subtitle}</p>
      <h1 className="mt-1 text-center text-4xl font-bold leading-tight">
        {title === "Tú versión Smart" ? (
          <>
            Tú versión
            <span className="block text-5xl font-extrabold text-club-cream">Smart</span>
          </>
        ) : (
          title
        )}
      </h1>
      {children}
    </div>
  );
}

export function CreamSheet({ children }: { children: ReactNode }) {
  return <div className="-mt-10 rounded-t-[2rem] bg-club-cream px-5 pb-10 pt-6">{children}</div>;
}

export function ClubPrimary({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`flex w-full items-center justify-between rounded-full bg-club-orange px-5 py-3.5 text-left text-base font-bold text-white shadow-md disabled:opacity-50 ${props.className ?? ""}`}
    >
      <span>{children}</span>
      <span aria-hidden>›</span>
    </button>
  );
}

export function ClubSecondary({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`flex w-full items-center justify-between rounded-full border-2 border-club-fuchsia bg-transparent px-5 py-3.5 text-left text-base font-bold text-club-fuchsia disabled:opacity-50 ${props.className ?? ""}`}
    >
      <span>{children}</span>
      <span aria-hidden>›</span>
    </button>
  );
}

export function VirtualCard({ name, code, pan, balance }: { name: string; code: string; pan: string; balance: string }) {
  return (
    <div className="rounded-[1.6rem] bg-gradient-to-br from-club-orange via-club-deep to-club-fuchsia p-5 text-white shadow-lg">
      <p className="text-xs uppercase tracking-[0.2em] text-white/80">SmartWallet · demo</p>
      <p className="mt-6 font-mono text-lg tracking-widest">{pan}</p>
      <div className="mt-6 flex justify-between text-sm">
        <div>
          <p className="text-white/70">Titular</p>
          <p className="font-bold">{name}</p>
        </div>
        <div className="text-right">
          <p className="text-white/70">Saldo</p>
          <p className="font-bold">{balance}</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-white/80">ID {code} · No es una tarjeta bancaria</p>
    </div>
  );
}
