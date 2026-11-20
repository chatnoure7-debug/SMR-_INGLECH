# SMR English

App Android (offline) para estudiar inglés técnico del CFGM SMR. Web móvil (Vite + TypeScript) empaquetada con Capacitor.

## Conseguir el APK (sin instalar nada en el PC)

1. Crea una cuenta en <https://github.com> y un repositorio nuevo (por ejemplo `smr-english`, privado o público).
2. Sube **todo el contenido de esta carpeta** al repositorio (en la web: *Add file → Upload files*, arrastrando los archivos y carpetas, incluida `.github`; o con `git push`). La rama debe llamarse `main`.
3. Abre la pestaña **Actions**. El flujo *Build Android APK* empieza solo con cada subida; también puedes lanzarlo con *Run workflow*.
4. Cuando salga en verde (unos 5–8 min), entra en esa ejecución y descarga el artefacto **smr-english-debug-apk** (ZIP con `app-debug.apk`).
5. Pasa el APK al móvil e instálalo. Android pedirá **permitir instalar desde orígenes desconocidos** para la app con la que lo abras (Archivos, Chrome...).

> La carpeta oculta `.github` es imprescindible. Si subes con la web y no la ves en el explorador de Windows, activa *Ver → Elementos ocultos*.

## Cómo se estudia (sin obligaciones)

- **Hoy**: sesión sugerida (repaso → palabras nuevas → lectura → listening → inglés del día a día → mini-test). Los 30 minutos son un **objetivo orientativo**: si no los cumples no pasa nada, y si quieres más, pulsa *Otra sesión* o usa **Estudiar** (sin límite).
- **Racha**: cuenta cualquier día en el que hagas algo. Si saltas días, no se castiga.
- **Examen**: simulacros *English for IT* y *Modelo B1*, con nota por RA (cada RA debe llegar a 5).
- **Tutor IA**: en la pestaña *Tutor* pega tu propia clave de API (Claude, OpenAI, Gemini u otro compatible). La clave se guarda solo en tu móvil: no está en este repositorio ni en las copias de seguridad. El tutor necesita internet; el resto de la app, no.

## Añadir contenido

Crea un archivo `content/<tema>.json` siguiendo `tools/import.md`, ejecuta `npm run validate` (opcional) y sube el cambio: no hace falta tocar código.

## Desarrollo local (opcional)

```bash
npm ci
npm run dev        # navegador, pantalla móvil 360×800
npm run validate   # revisa /content
npm run build
```

Requisitos del APK: `minSdk` 24, APK debug, sin Google Play, sin claves ni secretos.
