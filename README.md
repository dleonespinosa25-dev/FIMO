# FIMO

**Financial Internal Management & Operations**

Este repositorio es **FIMO**. Dentro está el demo **SmartWallet**: un prototipo educativo (no oficial) para el hackatón empresarial Farmaenlace x BYD (Ecuador).

Esta carpeta es una **demostración educativa**. No es la aplicación real de SmartClub, no está conectada a VENDIX, no habla con bancos y **no mueve dinero verdadero**. Todos los usuarios, productos, recargas y pagos son ficticios.

---

## Para quien revisa (lo más rápido)

1. **Ver el código en GitHub:** abra este repositorio: https://github.com/dleonespinosa25-dev/FIMO  
   Ahí están las carpetas `client` y `server` (no hace falta un ZIP).
2. **Probarlo en el navegador (mientras el PC del demo esté encendido):**  
   https://meetup-assignments-shaped-stood.trycloudflare.com/hub  
   Empiece siempre por **/hub**.
3. **Correrlo en su computadora:** clone el repo y siga “Cómo ejecutar el proyecto” más abajo.

Guía corta para el revisor: `REVIEWER.md`.

---

## Qué puede hacer este demo

Cualquier usuario registrado de la app de prueba puede:

1. Abrir **SmartWallet** (no hace falta ser socio).
2. Recargar un saldo simulado.
3. Ver el saldo.
4. Pagar en una caja presencial simulada (con código QR o escribiendo el código).
5. Pagar en una tienda online simulada.
6. Ver movimientos y comprobantes.

La **membresía SmartClub** es opcional. Solo el perfil socio recibe un descuento ficticio de ejemplo. Ese descuento **no** es una regla real de Farmaenlace.

---

## Qué necesita en su computadora

1. **Windows 10/11** (también funciona en Mac).
2. **Node.js** versión 20 o superior (incluye la herramienta `npm`).
   - Descargue el instalador en: [https://nodejs.org](https://nodejs.org)
   - Elija la versión LTS.
   - Instale con las opciones por defecto.
3. Un navegador (Chrome, Edge o Firefox).
4. Un editor si desea leer el código (Cursor o VS Code). No es obligatorio para usar el demo.
5. **Git**, si va a clonar este repositorio.

Para comprobar si Node.js quedó instalado:

1. Pulse la tecla Windows, escriba `PowerShell` y ábralo.
2. Copie y pegue este comando y pulse Enter:

```powershell
node -v
npm -v
```

Debe aparecer un número de versión, por ejemplo `v22.x.x`. Si aparece un error, reinstale Node.js y **cierre y vuelva a abrir** PowerShell.

---

## Cómo ejecutar el proyecto (paso a paso)

### Paso 1 — Obtener el código

Si lo descarga desde GitHub (recomendado para revisores):

```powershell
git clone https://github.com/dleonespinosa25-dev/FIMO.git
cd FIMO
```

Si ya tiene la carpeta en su computadora:

```powershell
cd "C:\Users\Pharmalys\Downloads\SmartWallet Demo"
```

Si movió la carpeta, use la ruta nueva.

### Paso 2 — Instalar las piezas del programa (solo la primera vez)

```powershell
npm install
```

Espere a que termine. Puede tardar uno o dos minutos. Se descargan librerías gratuitas de React, Express y Tailwind. **No se instalan pasarelas de pago ni servicios de banco.**

### Paso 3 — Encender el demo

```powershell
npm run dev
```

Deben aparecer dos servicios:

- **backend** en `http://localhost:3001` (la “caja fuerte” de los saldos).
- **app** en `http://localhost:5173` (lo que usted ve en el navegador).

### Paso 4 — Abrir el navegador

Escriba esta dirección:

**http://localhost:5173**

Esa es la app móvil de demostración de SmartClub.

Otras pantallas útiles:

| Qué quiere ver | Dirección |
| --- | --- |
| Menú de todos los modos | http://localhost:5173/hub |
| App SmartClub / SmartWallet | http://localhost:5173 |
| Caja VENDIX simulada | http://localhost:5173/pos |
| Panel administrativo | http://localhost:5173/admin |
| Smart Intelligence (corporativo) | http://localhost:5173/intelligence/login |

Deje la ventana de PowerShell abierta mientras usa el demo. Para apagarlo, pulse `Ctrl + C` en esa ventana.

---

## Cómo hacer una prueba completa en 3 minutos

Use **dos pestañas** del mismo navegador (así se ve que el saldo es compartido).

### Pestaña A — la app del cliente

1. Abra http://localhost:5173
2. Vaya a **Perfil** y elija **Ana Pérez** (usuario general, sin membresía).
3. Entre a **Wallet → Recargar**.
4. Elija $20 y pulse **Continuar al simulador**.
5. Pulse **Aprobar**. El saldo debe subir a $20.00.

### Pestaña B — la caja

1. Abra http://localhost:5173/pos
2. Verá el aviso permanente: `VENDIX SIMULATOR — NO CONECTADO A FARMAENLACE`.
3. Elija una marca, pulse productos y **Crear orden de cobro**.
4. Aparecerá un código (por ejemplo `SWPAY-…`) y un QR.

### Volver a la pestaña A

1. **Wallet → Pagar con QR**.
2. Escriba el código de la caja (o use el enlace “abrir cobro en esta computadora” que muestra la caja).
3. Pulse **Confirmar**.
4. La caja debe pasar sola a **PAGO APROBADO**.
5. En Wallet verá el movimiento y el comprobante.

Si recarga la página (F5), el saldo y el historial siguen ahí: los guarda el servidor, no el teléfono.

---

## Usuarios de prueba

| Nombre | Rol | SmartWallet | Beneficio demo |
| --- | --- | --- | --- |
| Ana Pérez | Usuario general | Sí, completo | Sin descuento de socio |
| Carlos Mendoza | Socio SmartClub | Sí, completo | 10% ficticio en el total de compra |

Carlos viene con **$50.00** de recarga inicial de demostración. Ana empieza en **$0.00**.

Para volver al punto de partida: **Perfil → Reiniciar datos demo**.

---

## Recargas

Montos rápidos: $10, $20, $50 u otro valor positivo.

Una recarga **aprobada** aumenta el saldo **una sola vez**.  
Una recarga **rechazada** no toca el saldo.

No se piden tarjetas, cuentas ni claves. El “procesador” es un botón de Aprobar/Rechazar.

---

## Si algo no abre

- **La página queda en blanco o “failed to fetch”:** confirme que `npm run dev` sigue corriendo y que existen las dos líneas `backend` y `app`.
- **El puerto 5173 está ocupado:** cierre otras ventanas de Vite o reinicie el computador.
- **El QR no funciona desde el celular:** es normal. `localhost` en el teléfono no es su computadora. Use el **código manual** en Pagar con QR.
- **Doble clic en Confirmar:** el sistema ignora el segundo clic. El dinero simulado se descuenta una vez.

---

## Recorridos para el jurado

**Enlace público (el PC debe seguir encendido):** https://meetup-assignments-shaped-stood.trycloudflare.com/hub  

Guía corta para el revisor: `REVIEWER.md`. Empiece siempre por **/hub**.

**SmartWallet es una pestaña de la app. No hay que ser socio para usarla.**

### DEMO 1 — Cliente

1. Hub → **QR de captación** o http://localhost:5173/captacion  
2. **Activar SmartWallet** → aceptar términos (el marketing va aparte; socio es opcional).  
3. Ver tarjeta `SW-DEMO-…` y saldo **$0**.  
4. Abrir la app (pestaña Wallet).  
5. En **VENDIX** → Recargar SmartWallet (cajero `cajero@farmaenlace.demo` / `Caja2026!`) código `SWC-ANA01` o el ID nuevo → **$20**.  
6. En la app, Recargar canal APP **$30**. Saldo **$50**.  
7. Compra física ~$12 y otra marca ~$18. Saldo **$20**.  
8. Intelligence (solo empresa) → Cliente 360 y **Data Flow Monitor**: se ve el antes/después. Recarga ≠ venta.

Para el celular use un túnel HTTPS (`cloudflared tunnel --url http://localhost:5173`) y `VITE_PUBLIC_APP_URL` en `client/.env`. **localhost no abre en el teléfono.**

### DEMO 2 — Escala

Intelligence → **Simulation Lab** → generar 1.000 (prueba) o 50.000 (guarde el archivo `server/data/lab.db` para no regenerar). Es volumen de datos, **no** 50.000 personas conectadas al mismo tiempo.

---

## Smart Intelligence (portal corporativo)

Smart Intelligence **no** aparece en la app móvil de SmartClub. Es un portal privado de demostración para Marketing, Finanzas y Dirección.

1. Abra http://localhost:5173/hub y elija **Smart Intelligence**, o vaya directo a `/intelligence/login`.
2. Entre con un usuario corporativo ficticio:

| Correo | Clave | Rol |
| --- | --- | --- |
| inteligencia@farmaenlace.demo | Intel2026! | Marketing |
| finanzas@farmaenlace.demo | Intel2026! | Finanzas |
| direccion@farmaenlace.demo | Intel2026! | Dirección |

Ahí verá 500+ clientes sintéticos, CLV histórico vs proyectado, segmentos RFM, riesgo de abandono **por reglas** (no es machine learning), venta cruzada entre marcas y recomendaciones de “siguiente acción” que **requieren aprobación humana**. No se envían campañas reales.

**Recarga ≠ venta.** El saldo que queda en SmartWallet no se cuenta como ganancia.

Si Ana o Carlos pagan una compra en la app, esa venta se refleja **una sola vez** en la ficha comercial (no así una recarga).

Pruebas automáticas del motor:

```powershell
npm test
```

---

## Aviso legal de demostración

Nombres de marcas aparecen **solo como referencia** para un ejercicio académico/de hackatón.  
No finja que esta es una aplicación oficial.  
No use este código para cobros reales.
