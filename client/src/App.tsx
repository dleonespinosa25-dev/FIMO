import { Navigate, Route, Routes } from "react-router-dom";
import { MobileShell } from "./components/MobileShell";
import { HomePage } from "./pages/HomePage";
import { WalletPage } from "./pages/WalletPage";
import { RechargePage } from "./pages/RechargePage";
import { PayPage } from "./pages/PayPage";
import { MovementPage } from "./pages/MovementPage";
import { BrandsPage } from "./pages/BrandsPage";
import { StoresPage } from "./pages/StoresPage";
import { ShopPage } from "./pages/ShopPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { ProfilePage } from "./pages/ProfilePage";
import { MembershipPage } from "./pages/MembershipPage";
import { PosPage } from "./pages/PosPage";
import { AdminPage } from "./pages/AdminPage";
import { HubPage } from "./pages/HubPage";
import { WelcomePage } from "./pages/WelcomePage";
import { RegisterPage } from "./pages/RegisterPage";
import { CaptacionPage, InstallPage } from "./pages/CaptacionPage";
import { IntelLayout } from "./intelligence/IntelLayout";
import {
  CampaignsPage,
  ClvPage,
  CrossPage,
  CustomerDetailPage,
  CustomersPage,
  IntelligenceLoginPage,
  NbaPage,
  OverviewPage,
  SegmentationPage,
  WalletIntelPage,
  FlowPage,
  LabPage,
} from "./intelligence/pages";

export default function App() {
  return (
    <Routes>
      <Route path="/hub" element={<HubPage />} />
      <Route path="/acceso" element={<WelcomePage />} />
      <Route path="/registro" element={<RegisterPage />} />
      <Route path="/captacion" element={<CaptacionPage />} />
      <Route path="/instalar" element={<InstallPage />} />
      <Route path="/pos" element={<PosPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/intelligence/login" element={<IntelligenceLoginPage />} />
      <Route path="/intelligence" element={<IntelLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="clientes" element={<CustomersPage />} />
        <Route path="clientes/:id" element={<CustomerDetailPage />} />
        <Route path="retencion" element={<SegmentationPage />} />
        <Route path="clv" element={<ClvPage />} />
        <Route path="marcas" element={<CrossPage />} />
        <Route path="nba" element={<NbaPage />} />
        <Route path="campanas" element={<CampaignsPage />} />
        <Route path="billetera" element={<WalletIntelPage />} />
        <Route path="flujo" element={<FlowPage />} />
        <Route path="lab" element={<LabPage />} />
      </Route>
      <Route path="/tienda/:brandId/pagar" element={<CheckoutPage />} />
      <Route element={<MobileShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/wallet/recargar" element={<RechargePage />} />
        <Route path="/wallet/pagar" element={<PayPage />} />
        <Route path="/wallet/pagar/:reference" element={<PayPage />} />
        <Route path="/wallet/movimiento/:id" element={<MovementPage />} />
        <Route path="/marcas" element={<BrandsPage />} />
        <Route path="/tiendas" element={<StoresPage />} />
        <Route path="/tienda/:brandId" element={<ShopPage />} />
        <Route path="/perfil" element={<ProfilePage />} />
        <Route path="/membresia" element={<MembershipPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
