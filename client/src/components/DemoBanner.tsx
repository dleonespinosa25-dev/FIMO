export function DemoBanner({ text }: { text?: string }) {
  return (
    <div className="rounded-2xl bg-amber-50 px-3 py-2 text-center text-[11px] font-medium leading-snug text-amber-900 ring-1 ring-amber-200">
      {text ??
        "PROTOTIPO NO OFICIAL · Fondos ficticios · No es una app de Farmaenlace, BYD ni SmartClub"}
    </div>
  );
}
