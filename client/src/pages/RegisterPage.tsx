import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClubHero, ClubPrimary, ClubSecondary, CreamSheet, VirtualCard } from "../club/ClubUi";
import { api, setSession } from "../lib/api";
import { usd } from "../lib/format";
import { useApp } from "../lib/AppContext";

type Step = "form" | "card" | "done";

export function RegisterPage() {
  const navigate = useNavigate();
  const { setUser, refresh } = useApp();
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("Lucía Demo");
  const [email, setEmail] = useState(`lucia.${Date.now().toString().slice(-6)}@smartclub.test`);
  const [phone, setPhone] = useState("+593 99 555 0101");
  const [password, setPassword] = useState("Demo2026!");
  const [terms, setTerms] = useState(false);
  const [consent, setConsent] = useState(false);
  const [wantMember, setWantMember] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{
    name: string;
    customerCode: string;
    virtualCard: string;
  } | null>(null);

  async function submit() {
    setError("");
    try {
      const data = (await api.register({
        name,
        email,
        phone,
        password,
        termsAccepted: terms,
        consentMarketing: consent,
        wantMember,
      })) as { token: string; user: { id: string; name: string; customerCode: string; virtualCard: string } };
      setSession(data.token);
      setUser(data.user.id);
      await refresh();
      setCreated({ name: data.user.name, customerCode: data.user.customerCode, virtualCard: data.user.virtualCard });
      setStep("card");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (step === "card" && created) {
    return (
      <div className="mx-auto min-h-screen max-w-md bg-club-cream">
        <ClubHero title="Tu tarjeta digital" subtitle="Obtén tu tarjeta digital" />
        <CreamSheet>
          <VirtualCard name={created.name} code={created.customerCode} pan={created.virtualCard} balance={usd(0)} />
          <p className="mt-4 text-sm text-club-ink/70">
            Número de demostración. No es un PAN bancario ni un identificador financiero válido. Saldo inicial $0.00.
          </p>
          <p className="mt-2 text-xs">ID de cliente: {created.customerCode}</p>
          <div className="mt-6">
            <ClubPrimary onClick={() => setStep("done")}>Continuar</ClubPrimary>
          </div>
        </CreamSheet>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="mx-auto min-h-screen max-w-md bg-club-cream">
        <ClubHero title="Cuenta creada" subtitle="Activa tu SmartWallet" />
        <CreamSheet>
          <p className="text-center text-lg font-semibold text-club-orange">Ya puedes usar la pestaña Wallet</p>
          <p className="mt-2 text-center text-sm">Sin membresía obligatoria. Recarga cuando quieras (fondos ficticios).</p>
          <div className="mt-6">
            <ClubPrimary onClick={() => navigate("/wallet")}>Abrir la app</ClubPrimary>
          </div>
          <div className="mt-3">
            <ClubSecondary onClick={() => navigate("/instalar")}>Instalar en este teléfono</ClubSecondary>
          </div>
        </CreamSheet>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-md bg-club-cream">
        <ClubHero title="Crea tu cuenta" subtitle="Paso 1 · datos para tu SmartWallet" />
      <CreamSheet>
        <label className="text-xs font-bold">Nombre</label>
        <input className="mb-3 mt-1 w-full rounded-2xl bg-white px-4 py-3" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="text-xs font-bold">Correo</label>
        <input className="mb-3 mt-1 w-full rounded-2xl bg-white px-4 py-3" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="text-xs font-bold">Celular</label>
        <input className="mb-3 mt-1 w-full rounded-2xl bg-white px-4 py-3" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <label className="text-xs font-bold">Contraseña demo</label>
        <input className="mb-3 mt-1 w-full rounded-2xl bg-white px-4 py-3" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          Acepto términos del prototipo (fondos ficticios, no es Farmaenlace oficial).
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          Acepto comunicaciones comerciales (opcional, separado de los términos).
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input type="checkbox" checked={wantMember} onChange={(e) => setWantMember(e.target.checked)} />
          Quiero ser socio SmartClub (opcional). No es requisito para la billetera.
        </label>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        <div className="mt-5">
          <ClubPrimary onClick={submit} disabled={!terms}>
            Crear cuenta gratis
          </ClubPrimary>
        </div>
      </CreamSheet>
    </div>
  );
}
