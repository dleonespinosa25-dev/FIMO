import { Link, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { ClubHero, ClubPrimary, CreamSheet } from "../club/ClubUi";

export function CaptacionPage() {
  const navigate = useNavigate();
  const signupUrl = `${window.location.origin}/registro`;
  const publicHost = window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";

  return (
    <div className="mx-auto min-h-screen max-w-md bg-club-cream">
      <ClubHero title="Activa tu SmartWallet" subtitle="QR para sacar tu tarjeta · no es la caja VENDIX" />
      <CreamSheet>
        <p className="text-center text-sm text-club-ink/70">
          Escanee o toque el QR. Lo lleva a <b>llenar sus datos y crear la tarjeta virtual</b>. No hace falta ser socio. VENDIX es solo para el cajero.
        </p>
        <button
          type="button"
          onClick={() => navigate("/registro")}
          className="mx-auto mt-5 block rounded-3xl bg-white p-4 shadow-md ring-2 ring-club-orange"
          aria-label="Abrir formulario de SmartWallet"
        >
          <QRCodeSVG value={signupUrl} size={220} />
        </button>
        <p className="mt-3 break-all text-center text-xs text-club-ink/60">{signupUrl}</p>
        {publicHost && (
          <p className="mt-3 rounded-2xl bg-white p-3 text-xs text-club-ink/80">
            Enlace público activo. Cualquier persona puede escanear este QR o abrir esa dirección.
          </p>
        )}
        <div className="mt-6">
          <ClubPrimary onClick={() => navigate("/registro")}>Llenar datos y crear tarjeta</ClubPrimary>
        </div>
        <p className="mt-4 text-center text-[11px] text-club-ink/50">
          Este QR no cobra. El QR de pago lo genera el cajero en VENDIX después de iniciar sesión.
        </p>
      </CreamSheet>
    </div>
  );
}

export function InstallPage() {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-club-cream px-5 py-10">
      <h1 className="text-2xl font-bold text-club-ink">Instalar la app (PWA demo)</h1>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
        <li>En Chrome o Edge, abra el menú y elija <b>Instalar aplicación</b> o <b>Agregar a pantalla de inicio</b>.</li>
        <li>En iPhone, Safari → Compartir → <b>Agregar a pantalla de inicio</b>.</li>
        <li>Siga usando la pestaña <b>Wallet</b>. No necesita ser socio.</li>
      </ol>
      <Link to="/wallet" className="mt-8 block text-center font-bold text-club-orange">
        Ir a SmartWallet
      </Link>
    </div>
  );
}
