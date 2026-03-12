# 🔐 Configuración del Panel Administrativo - Panter Studio

## Seguridad Real con Firebase Authentication

Tu panel administrativo ahora usa **Firebase Authentication** real en lugar de credenciales hardcodeadas. Sigue estos pasos para configurarlo:

---

## 📋 Paso 1: Activar Firebase Authentication

1. Ve a la [Consola de Firebase](https://console.firebase.google.com/)
2. Selecciona tu proyecto: **panterweb-a9112**
3. En el menú lateral, haz clic en **Authentication**
4. Si es la primera vez, haz clic en **"Comenzar"**
5. Ve a la pestaña **"Sign-in method"**
6. Haz clic en **"Correo electrónico/contraseña"**
7. Activa el interruptor
8. Haz clic en **"Guardar"**

---

## 👤 Paso 2: Crear Usuario Administrador

1. En **Authentication**, ve a la pestaña **"Users"**
2. Haz clic en **"Add user"**
3. Ingresa:
  - **Email:** Tu correo administrativo (elige uno privado)
   - **Password:** Crea una contraseña segura (mínimo 6 caracteres)
4. Haz clic en **"Add user"**

> ⚠️ **Importante:** Guarda la contraseña en un lugar seguro. Esta será tu contraseña real de administrador.

---

## 🔒 Paso 3: Configurar Reglas de Firestore (IMPORTANTE)

Para que solo administradores autenticados puedan modificar juegos, actualiza las reglas de Firestore:

1. Ve a **Firestore Database** → **Reglas** (pestaña "Rules")
2. Reemplaza las reglas actuales con estas:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Pre-registros: cualquiera puede leer, solo escritura autenticada
    match /preregistros/{document=**} {
      allow read: if true;
      allow create: if request.auth == null; // Permitir desde formulario público
      allow update, delete: if request.auth != null; // Solo administradores
    }
    
    // Juegos: lectura pública, solo administradores pueden modificar
    match /games/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Otras colecciones: solo administradores
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Haz clic en **"Publicar"**

---

## 🎮 Paso 4: Crear Colección de Juegos

Firestore creará automáticamente la colección `games` cuando agregues el primer juego desde el panel. No necesitas crearla manualmente.

---

## 🚀 Paso 5: Probar el Panel

1. Abre: `https://panterstudio.github.io/admin.html`
2. Inicia sesión con:
  - **Email:** El que configuraste en Authentication
   - **Password:** La contraseña que creaste

3. Deberías ver:
   - Estadísticas de pre-registros
   - Tabla con registros
   - Sección "Gestión de Juegos" con botón "+ Agregar Juego"

---

## 🎮 Funcionalidades del Panel

### Gestión de Pre-registros
- Ver todos los registros
- Exportar a CSV
- Ver fuente de datos (Firebase/localStorage)

### Gestión de Juegos
- **Crear:** Agregar nuevos juegos con título, descripción, imagen, estado, fecha de lanzamiento y etiquetas
- **Editar:** Modificar cualquier juego existente
- **Eliminar:** Borrar juegos (con confirmación)
- **Estados disponibles:**
  - 🟠 Planificación
  - 🔵 En Desarrollo
  - 🟣 En Pruebas
  - 🟢 Lanzado
  - ⚪ Pausado

---

## 🔐 Métodos de Acceso al Panel

1. **URL directa:** `admin.html`
2. **Botón oculto:** Punto casi invisible en esquina inferior derecha de index.html
3. **Atajo de teclado:** `Ctrl + Shift + A`

---

## 🛡️ Seguridad Mejorada

### Antes (inseguro):
- ❌ Credenciales hardcodeadas en JavaScript
- ❌ Cualquiera podía ver el código y la contraseña
- ❌ Sin protección real en base de datos

### Ahora (seguro):
- ✅ Firebase Authentication real
- ✅ Contraseña encriptada en servidores de Google
- ✅ Reglas de Firestore que bloquean acceso no autorizado
- ✅ Token JWT para cada sesión
- ✅ Logout seguro

---

## ⚠️ Problemas Comunes

### "Firebase Auth no cargó a tiempo"
- Revisa tu conexión a internet
- Verifica que `assets/js/core/firebase-config.js` tenga las credenciales correctas
- Limpia caché del navegador (Ctrl + Shift + R)

### "Credenciales incorrectas"
- Verifica que el email esté escrito correctamente (sin espacios)
- Asegúrate de haber creado el usuario en Firebase Authentication
- La contraseña debe tener mínimo 6 caracteres

### No puedo agregar juegos
- Verifica que hayas publicado las reglas de Firestore
- Verifica que estés autenticado (deberías ver el panel, no el login)
- Revisa la consola del navegador (F12) para ver errores

---

## 📊 Datos de Prueba

Puedes crear juegos de prueba con estos datos:

**Juego 1:**
- Título: Nuestra Tierra Job Simulator
- Descripción: Simulador de trabajos en mundo abierto donde exploras profesiones y construyes tu vida.
- Estado: En Desarrollo
- Etiquetas: Simulador, Mundo Abierto, RPG

**Juego 2:**
- Título: Panter Arena
- Descripción: Battle royale competitivo con mecánicas únicas y combate estratégico.
- Estado: Planificación
- Etiquetas: Battle Royale, Multijugador, Acción

---

## 🎯 Próximos Pasos

Una vez configurado el panel, puedes:

1. Agregar todos tus juegos actuales y futuros
2. Actualizar estados conforme avance el desarrollo
3. Mostrar los juegos dinámicamente en tu página principal (opcional)
4. Agregar más administradores creando usuarios adicionales en Firebase Auth

---

## 🆘 Soporte

Si tienes problemas:
1. Revisa la consola del navegador (F12)
2. Verifica que Firebase Authentication esté habilitado
3. Confirma que las reglas de Firestore estén publicadas
4. Asegúrate de usar HTTPS (GitHub Pages lo hace automáticamente)

---

Desarrollado por **Panter Studio** 🐾
