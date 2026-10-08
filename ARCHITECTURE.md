# Arquitectura — SMARTWALLET Demo

Prototipo local, no oficial. Pensado para explicar a un jurado de negocio **cómo se conectaría** una billetera recargable al ecosistema SmartClub, sin pretender seguridad ni integraciones de producción.

## Diagrama de capas

```
┌─────────────────────────────────────────────────────────────┐
│  SmartClub App (React)                                      │
│  Inicio · Marcas · Tiendas · Perfil · Membresía             │
│                         │                                   │
│              ┌──────────▼──────────┐                        │
│              │    SmartWallet UI   │                        │
│              │ saldo, recarga, QR, │                        │
│              │ historial, recibos  │                        │
│              └──────────┬──────────┘                        │
└─────────────────────────┼───────────────────────────────────┘
                          │  HTTP /api  (polling 2s)
┌─────────────────────────▼───────────────────────────────────┐
│  Backend Express (única fuente de verdad del saldo)         │
│                                                             │
│  Payment Provider Mock  → recargas approve/reject           │
│  VENDIX Mock Adapter    → órdenes físicas + QR de referencia│
│  E-commerce Mock Adapter→ checkout online sin QR            │
│  Membership / Benefits  → descuento demo solo para socios   │
│  Wallet Ledger          → movimientos auditables en JSON    │
│  Smart Intelligence *   → CLV, RFM, NBA (datos sintéticos)  │
└─────────────────────────────────────────────────────────────┘
     persistencia: server/data/db.json          (libro de billetera)
                   server/data/intelligence.json (libro comercial)

* Portal /intelligence con sesión corporativa. No se monta en la app del cliente.
  Una compra aprobada (idempotente) emite un evento comercial. Una recarga no.
```

La app **nunca** cambia el saldo en el navegador. Solo muestra lo que responde el backend.

## Principios financieros del demo

- Moneda **USD**. Importes en **centavos enteros** (2000 = $20.00).
- El saldo de un usuario es la suma de movimientos con estado `approved` y `signedAmountCents`.
- Recargas aprobadas suman. Pagos aprobados restan. Reembolsos suman. Rechazos y cancelaciones valen 0.
- Un pago o una recarga se asientan **una vez**. Claves de idempotencia evitan doble cobro por doble clic.
- El reembolso **no borra** el pago original: deja un segundo movimiento de reversión.
- SmartWallet y membresía están **separados**. El descuento es un beneficio promocional de demostración; el saldo recargado es otra cosa.

## Endpoints

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/health` | Salud del servidor |
| GET | `/api/catalog` | Usuarios, marcas, productos, regla de membresía |
| POST | `/api/demo/reset` | Reinicia datos ficticios |
| GET | `/api/wallet` | Consultar billetera y movimientos |
| GET | `/api/wallet/movements/:id` | Detalle / comprobante |
| POST | `/api/recharges` | Solicitar recarga (`amountCents`) |
| POST | `/api/recharges/:id/simulate` | Confirmar recarga ficticia `{ outcome: "approved" \| "rejected" }` |
| POST | `/api/orders` | Crear orden de pago (caja o canal físico) |
| GET | `/api/orders/:id` | Consultar orden (id o referencia). Estados: pending, approved, rejected, cancelled |
| POST | `/api/payments/confirm` | Confirmar pago `{ reference, idempotencyKey }` |
| POST | `/api/payments/cancel` | Cancelar pago |
| POST | `/api/online/checkout` | Crear + confirmar compra online |
| POST | `/api/refunds` | Reembolso ficticio `{ movementId }` |
| GET | `/api/admin/stats` | Totales del panel (demo existente, sin login) |
| POST | `/api/intelligence/login` | Sesión corporativa |
| GET | `/api/intelligence/*` | Métricas CLV/RFM/NBA (Bearer token) |

Cabecera de usuario de prueba: `X-Demo-User-Id: user-general` o `user-socio`.

El QR **solo** transporta `SMARTWALLET:PAY:<REFERENCIA>`. Nunca números de tarjeta.

## Cómo reemplazar los simuladores (futuro, con autorización)

Este proyecto **no** debe conectarse a bancos ni a VENDIX sin contratos y llaves oficiales. Cuando exista autorización:

1. **Payment Provider Mock** (`POST /api/recharges` + `/simulate`)  
   Sustituir por un proveedor de recargas/pagos homologado en Ecuador. El backend recibiría un webhook firmado `recharge.approved` y ejecutaría el mismo asiento de crédito **idempotente**.

2. **VENDIX Mock Adapter** (`POST /api/orders`, consulta de estado)  
   Sustituir por el API de caja autorizado de Farmaenlace/VENDIX: crear cobro, devolver referencia, notificar `PAID`. SmartWallet seguiría confirmando contra el **ledger propio**, no contra la UI.

3. **E-commerce Mock Adapter**  
   El checkout oficial llamaría `create order` + `confirm` (o un payment intent) con el mismo contrato de montos en centavos.

4. **Membership / Benefits**  
   Consumir el servicio real de fidelización. Seguir calculando el total **antes** de debitar la billetera, y contabilizar descuentos aparte del saldo recargado.

5. **Ledger**  
   Migrar `db.json` a una base transaccional (por ejemplo PostgreSQL) con transacciones ACID, firmas, conciliación y no-repudio.

Hasta entonces, cualquier integración “real” estaría fuera de alcance y sería un riesgo operativo.

## Limitaciones deliberadas

- Entorno local, pocos usuarios de prueba.
- Sin autenticación bancaria, sin PCI, sin cifrado de producción.
- Sin logos oficiales; avatares de color genéricos.
- Accesorios BYD de bajo valor; no hay simulación de vehículos ni crédito automotriz.
