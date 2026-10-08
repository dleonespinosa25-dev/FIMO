# Checklist de pruebas — SMARTWALLET Demo

Todos los resultados se verifican con fondos ficticios. Marque cada casilla en la defensa del hackatón.

| # | Escenario | Cómo probarlo | Resultado esperado |
| --- | --- | --- | --- |
| 1 | Usuario sin membresía recarga y paga | Perfil → Ana Pérez. Recargar $20 (aprobar). Caja o tienda: comprar un ítem barato y confirmar. | Saldo Ana sube $20 y luego baja el total **sin** descuento de socio. |
| 2 | Usuario con membresía recibe descuento elegible | Perfil → Carlos Mendoza. Checkout o pago físico. | Se ven Subtotal, Descuento 10% demo, Total final y Saldo utilizado. Ana no ve el 10%. |
| 3 | Pago físico con QR y confirmación en caja | `/pos` crea orden. App confirma. | Caja pasa sola a **PAGO APROBADO**. Aviso VENDIX visible todo el tiempo. |
| 4 | Pago online con saldo disponible | Tienda de cualquier marca → carrito → SmartWallet → confirmar. | Comprobante online, sin QR. Movimiento canal **Online**. |
| 5 | Pagar sin saldo suficiente | Ana en $0 intenta pagar. | Mensaje de saldo insuficiente. Saldo sigue $0. Queda un intento **rechazado**. |
| 6 | Recarga rechazada | Recargar $10 y pulsar **Rechazar**. | El saldo no cambia. Historial muestra recarga rechazada. |
| 7 | Doble clic en confirmar | En un cobro pendiente, pulsar Confirmar dos veces rápido. | Un solo débito. El segundo intento no vuelve a descontar. |
| 8 | Reembolso y reversión | Abrir un pago aprobado → Simular reembolso. | El pago original permanece. Aparece un movimiento REFUND. El saldo se restituye. |
| 9 | Historial persistente | Recargar, pagar, pulsar F5. | Saldo y movimientos siguen. Viven en el servidor (`db.json`). |
| 10 | Flujo en las seis marcas | Repetir una compra (física u online) en Farmacias Económicas, Medicity, Wellderma, Ambiente, Mascotas y BYD. | Cada movimiento identifica la marca. BYD solo accesorios de bajo valor. |

Pruebas extra:

- Cambiar de Ana a Carlos y ver **otro** saldo.
- Panel `/admin`: totales de recargas, físicos, online, socios vs generales.
- **Reiniciar datos demo** restaura a Carlos con $50 y Ana con $0.
- El QR no muestra datos de tarjeta (solo `SMARTWALLET:PAY:…`).
- Smart Intelligence exige login. Sin token, `/api/intelligence/overview` responde 401.
- Intelligence no aparece en Inicio, Wallet ni Perfil de la app del cliente.
- Una recarga de Ana no aumenta sus compras comerciales; un pago aprobado sí, y solo una vez.
- Un cliente con 1 compra muestra “No proyectable” en CLV; uno leal muestra histórico y proyectado por separado.
- BYD no se evalúa con el ciclo de farmacia.
- Aprobar/rechazar NBA no envía mensajes; el estado queda pendiente/aprobado/rechazado.
- Campañas distinguen observado vs simulado vs estimado.
