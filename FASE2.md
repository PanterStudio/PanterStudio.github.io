# Fase 2 — Seguridad real (backend + Firebase Auth)

## El problema que resuelve

En la **Fase 1** (actual, GitHub Pages estático) el login de Discord usa OAuth
**implícito**: el token llega en el hash de la URL y se guarda en el navegador.
Firebase Firestore **no ve ningún `request.auth`**, así que las reglas no pueden
saber quién escribe. Cualquier cliente podría, por ejemplo, escribir
`equipo/{uid}` con `role: "founder_ceo"` y darse permisos.

La **Fase 2** mueve el secreto de Discord al servidor y emite un **custom token**
de Firebase Auth. El cliente lo canjea con `signInWithCustomToken` y a partir de
ahí cada escritura lleva un `request.auth.uid` verificado criptográficamente.

## Qué se implementó (listo, pero **apagado** por defecto)

| Pieza | Archivo | Estado |
|---|---|---|
| Backend OAuth + custom token | `server/phase2-auth.js` | Listo |
| Registro de rutas | `server.js` | Listo |
| Canje en el cliente | `assets/js/core/firebase-config.js`, `assets/js/core/discord-auth.js` | Listo |
| Reglas endurecidas | `firestore.rules.phase2` | **NO publicadas** |
| Reglas activas | `firestore.rules` | Sin cambios (Fase 1) |

**Degradación automática:** si el backend no responde o no tiene secretos,
`/api/auth/config` devuelve `phase2: false` y el cliente sigue usando el flujo
implícito de siempre. La web no se rompe en ningún momento.

---

## Cómo activarla (en este orden)

### 1. Registrar la Redirect URI en Discord

En el [Developer Portal](https://discord.com/developers/applications) → tu app →
OAuth2 → Redirects, añade **exactamente**:

```
https://panterstudio.lat/api/auth/discord/callback
```

(y `http://localhost:5000/api/auth/discord/callback` para probar en local).

### 2. Configurar el servidor

El backend es **Node/Express** (`server.js`). Necesita estas variables de entorno.
**Ninguna va al cliente ni al repositorio.**

| Variable | Descripción |
|---|---|
| `DISCORD_CLIENT_ID` | ID público de la app (por defecto el actual) |
| `DISCORD_CLIENT_SECRET` | Secreto de OAuth2 ← **obligatorio** |
| `DISCORD_REDIRECT_URI` | La URI del paso 1 |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON completo de la cuenta de servicio |
| `GOOGLE_APPLICATION_CREDENTIALS` | Alternativa: ruta al JSON (ADC) |
| `FIREBASE_PROJECT_ID` | `nuestratierra-2bb4a` |
| `SESSION_SECRET` | Cadena aleatoria larga para firmar la cookie |
| `PHASE2_COOKIE_SECURE` | `0` sólo en HTTP local |

La cuenta de servicio se crea en Firebase Console → Project settings →
**Service accounts** → *Generate new private key*. Debe tener el rol
*Firebase Admin SDK Administrator Service Agent*.

> `firebase-admin` se importa de forma **dinámica** y NO está en
> `dependencies` a propósito: así `npm ci` del sitio estático sigue limpio y
> la Fase 1 nunca se rompe. Instálalo **sólo en el servidor** que active Fase 2.

```bash
npm install firebase-admin@^11.11.1 --no-save
DISCORD_CLIENT_SECRET=xxx \
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}' \
SESSION_SECRET='un-secreto-largo-y-aleatorio' \
DISCORD_REDIRECT_URI='https://panterstudio.lat/api/auth/discord/callback' \
node server.js
```

> La web debe servirse **desde ese mismo servidor** (o detrás del mismo dominio)
> para que `/api/auth/*` exista. En GitHub Pages puro no hay backend: Fase 2
> quedará apagada y seguirá funcionando la Fase 1.

### 3. Verificar ANTES de publicar reglas

Con el backend arriba, abre la consola del navegador en producción y comprueba:

```js
await (await fetch('/api/auth/config')).json()
// → { phase2: true, ... }

window.DiscordAuth.isPhase2()          // → true
window.DiscordAuth.hasFirebaseAuth()   // → true DESPUÉS de iniciar sesión
```

Si `hasFirebaseAuth()` es `false`, **no publiques las reglas**: significa que el
custom token no se está canjeando y dejarías a los usuarios sin poder escribir.

### 4. Publicar las reglas endurecidas (último paso)

Firebase Console → `nuestratierra-2bb4a` → Firestore Database → **Reglas**:
copia el contenido de **`firestore.rules.phase2`** y pulsa *Publicar*.

O, con Firebase CLI autenticado:

```bash
cp firestore.rules.phase2 firestore.rules   # sólo cuando el paso 3 esté OK
npm run deploy:rules
```

> ⚠️ **No hagas este paso antes del 3.** Las reglas de Fase 2 exigen
> `request.auth`; si un cliente sigue en Fase 1, todas sus escrituras serán
> rechazadas (`permission-denied`).

### 5. Probar el flujo completo

1. Cerrar sesión y volver a entrar con Discord.
2. Confirmar que ya **no** aparece `access_token` en la URL (ahora es `?code=`).
3. Crear un ticket, responder como staff, verificar sincronización entre dos cuentas.
4. Confirmar que un usuario normal **no** puede escribir en `equipo/`.

---

## Cambio de comportamiento de seguridad

Con Fase 2 activa:

- `equipo/{uid}` sólo lo escriben `founder_ceo` / `administrador` / `programador`
  / `modelador`, y **sólo con ids de los 9 rangos oficiales**.
- `conductores/{uid}` lo edita su dueño o el staff (ya no cualquiera).
- `presencia/{uid}` sólo lo escribe ese uid.
- Los tickets los crea un usuario autenticado **en su propio nombre**
  (`usuarioId == request.auth.uid`) y los gestiona el staff de tickets.
- La pertenencia al servidor oficial de Discord la verifica **el servidor**, no
  el cliente con un token expuesto.

## Registro de lo que NO se hizo

- No se publicó `firestore.rules.phase2` (requiere backend desplegado primero).
- No se guardó ningún secreto en el repositorio.
- No se cambió `firestore.rules` (Fase 1) ni el `firebase.json`.
- No se eliminó la Fase 1: es el fallback que mantiene la web online.
