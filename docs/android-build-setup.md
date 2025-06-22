# Configuración de Build para Android

## Pre-requisitos

1. **Android Studio** instalado con SDK Tools
2. **Java JDK 17** o superior
3. **Node.js** versión 18+
4. **Capacitor CLI** instalado globalmente: `npm install -g @capacitor/cli`

## Variables de Entorno Críticas

### ⚠️ IMPORTANTE: Configurar antes del build

Edita el archivo `.env.android` y cambia estas variables:

```bash
# ❌ NO USAR localhost en Android
NEXT_PUBLIC_BASE_URL="http://localhost:3000"  # ❌ CAMBIAR ESTO
NEXTAUTH_URL="http://localhost:3000"          # ❌ CAMBIAR ESTO

# ✅ USAR tu dominio de producción
NEXT_PUBLIC_BASE_URL="https://tu-dominio.com"
NEXT_PUBLIC_APP_URL="https://tu-dominio.com"
NEXTAUTH_URL="https://tu-dominio.com"
NEXT_PUBLIC_API_URL="https://tu-dominio.com/api"
```

## Configuración de Google OAuth para Android

1. **Google Cloud Console**:

   - Ve a tu proyecto en [Google Cloud Console](https://console.cloud.google.com)
   - En "Credenciales" → "OAuth 2.0 Client IDs"
   - Agrega una nueva credencial para Android:
     - **Tipo**: Android
     - **Package name**: `com.paloparti.app`
     - **SHA-1**: Obtén del keystore de Android

2. **Obtener SHA-1 del keystore**:

   ```bash
   # Debug keystore (desarrollo)
   cd android
   ./gradlew signingReport

   # O manualmente:
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```

## Pasos de Build

### 1. Preparar el entorno

```bash
# Instalar dependencias de Capacitor
npm install

# Sincronizar configuración
npx cap sync android
```

### 2. Build para desarrollo

```bash
# Build y ejecutar en dispositivo/emulador
npm run android:dev
```

### 3. Build para producción

```bash
# Build APK de producción
npm run android:build
```

### 4. Build manual (si es necesario)

```bash
# 1. Build de Next.js con configuración Android
cp .env.android .env.local
npm run build
npm run export

# 2. Sincronizar con Capacitor
npx cap sync android

# 3. Abrir en Android Studio
npx cap open android

# 4. Restaurar configuración original
cp .env.local.bak .env.local
```

## Problemas Comunes

### 1. Error de "localhost not accessible"

**Causa**: URLs hardcodeadas a localhost en el código
**Solución**: Verificar que todas las variables de entorno apunten a tu dominio de producción

### 2. Error de autenticación

**Causa**: Google OAuth no configurado para Android
**Solución**: Seguir los pasos de configuración de Google OAuth

### 3. Error de CORS

**Causa**: El servidor no permite requests desde la app móvil
**Solución**: Verificar configuración de CORS en `next.config.js`

### 4. Error de certificados SSL

**Causa**: Certificado no confiable en Android
**Solución**: Usar certificados válidos en producción

## Estructura de Archivos Importantes

```
android/
├── app/
│   ├── src/main/
│   │   ├── assets/
│   │   │   └── capacitor.config.json  # Config sincronizada
│   │   └── AndroidManifest.xml
│   └── build.gradle
├── build.gradle
└── gradle.properties

capacitor.config.ts                    # Config principal
.env.android                          # Variables específicas Android
out/                                  # Build de Next.js exportado
```

## Testing

### En Emulador

```bash
# Crear AVD desde Android Studio
# Luego ejecutar:
npm run android:dev
```

### En Dispositivo Físico

```bash
# Habilitar "Depuración USB" en el dispositivo
# Conectar via USB
npm run android:dev
```

## Deploy

### APK Firmado para Release

1. Generar keystore:

   ```bash
   keytool -genkey -v -keystore my-release-key.keystore -keyalg RSA -keysize 2048 -validity 10000 -alias my-key-alias
   ```

2. Configurar en `android/app/build.gradle`:

   ```gradle
   android {
       signingConfigs {
           release {
               keyAlias 'my-key-alias'
               keyPassword 'password'
               storeFile file('my-release-key.keystore')
               storePassword 'password'
           }
       }
   }
   ```

3. Build release:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

## Notas Importantes

- **Siempre probar** en dispositivo real antes del release
- **Verificar permisos** en AndroidManifest.xml
- **Validar URLs** en todas las configuraciones
- **Probar autenticación** con Google OAuth en Android
- **Testing en diferentes versiones** de Android (API levels)

## Solución de Problemas

Si algo no funciona:

1. Limpiar cache:

   ```bash
   cd android
   ./gradlew clean
   npx cap sync android
   ```

2. Verificar logs:

   ```bash
   npx cap run android --livereload --external
   ```

3. Debug remoto:
   - Chrome DevTools → chrome://inspect
   - Seleccionar el WebView de tu app
