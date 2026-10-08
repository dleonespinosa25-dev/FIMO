import { useNavigate } from "react-router-dom";
import { ClubHero, ClubPrimary, ClubSecondary, CreamSheet } from "../club/ClubUi";

export function WelcomePage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto min-h-screen max-w-md bg-club-cream">
      <ClubHero title="Tú versión Smart" subtitle="SmartClub · prototipo">
        <img
          src="/smartclub-hero.png"
          alt="SmartClub"
          className="mx-auto mt-4 h-56 w-auto rounded-3xl object-cover object-top"
        />
      </ClubHero>
      <CreamSheet>
        <p className="mb-5 text-center text-lg font-semibold text-club-orange">El club que te conecta</p>
        <p className="mb-5 text-center text-sm text-club-ink/70">
          SmartWallet es una pestaña más de la app. <b>No hace falta ser socio</b> para recargar y pagar. La membresía es un extra opcional.
        </p>
        <ClubPrimary onClick={() => navigate("/registro")}>Activar SmartWallet (crear tarjeta)</ClubPrimary>
        <div className="mt-3">
          <ClubSecondary onClick={() => navigate("/")}>Ya soy smart</ClubSecondary>
        </div>
        <button onClick={() => navigate("/captacion")} className="mt-3 w-full text-center text-sm font-semibold text-club-ink">
          Ver QR para sacar la tarjeta
        </button>
        <button onClick={() => navigate("/membresia")} className="mt-4 w-full text-center text-sm font-semibold text-club-fuchsia">
          Quiero ser socio (opcional)
        </button>
        <p className="mt-6 text-center text-[11px] text-club-ink/50">Fondos ficticios. No es la app oficial de Farmaenlace.</p>
      </CreamSheet>
    </div>
  );
}
