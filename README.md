# 🏊‍♂️🚴‍♂️🏃‍♂️ Race Club Hub - Check-in

Sistema de check-in para triatlón con escaneo de códigos QR, envío por WhatsApp/Email, desplegado en Cloudflare Pages + Workers KV.

**URL:** https://raceclubhub.com

## Funcionalidades

- 📷 **Escáner QR** - Escanea el código QR del atleta con la cámara
- 🔍 **Búsqueda manual** - Busca por número de dorsal o nombre
- 📋 **Lista completa** - Filtra por categoría y estado de check-in
- 📊 **Estadísticas** - Progreso de check-in en tiempo real
- 🏷️ **Códigos QR** - Genera e imprime los QR para distribuir
- 📱 **Envío por WhatsApp** - Envía el QR directo al celular del atleta vía WhatsApp
- 📧 **Envío por Email** - Envía email con diseño profesional y link al QR personal
- 📤 **Envío masivo** - Envía a todos los atletas de una vez (WhatsApp o Email)

## Arquitectura

| Componente | Tecnología |
|-----------|-----------|
| Frontend | HTML/CSS/JS estático en Cloudflare Pages |
| Backend API | Cloudflare Pages Functions (Workers) |
| Base de datos | Cloudflare Workers KV |
| QR Scanner | html5-qrcode (cámara del dispositivo) |
| QR Generator | qrcode.js (generación client-side) |
| Email | MailChannels API (gratis con Cloudflare Workers) |
| WhatsApp | wa.me links (API gratuita, sin servidor) |
| Dominio | raceclubhub.com via Cloudflare |

## Despliegue

### 1. Crear KV Namespace

```bash
npx wrangler kv:namespace create CHECKIN_KV
```

Copiar el `id` que te devuelve y pegarlo en `wrangler.toml`.

### 2. Subir datos de participantes al KV

```bash
npx wrangler kv:key put --namespace-id=YOUR_ID "participants" "$(cat data/participants.json)"
```

### 3. Configurar variables de entorno (opcional, para email)

En el dashboard de Cloudflare Pages > Settings > Environment Variables:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `FROM_EMAIL` | Email remitente | `checkin@raceclubhub.com` |
| `FROM_NAME` | Nombre remitente | `Race Club Hub` |
| `DKIM_DOMAIN` | Dominio DKIM (opcional) | `raceclubhub.com` |
| `DKIM_SELECTOR` | Selector DKIM (opcional) | `mailchannels` |
| `DKIM_PRIVATE_KEY` | Llave privada DKIM (opcional) | `MIIEpAIBAAK...` |

> **Nota:** Sin DKIM los emails pueden caer en spam. Para configurar DKIM, ver la [guía de MailChannels + Cloudflare](https://support.mailchannels.com/hc/en-us/articles/16918954360845).

### 4. Configurar DNS para MailChannels

Agregar este registro TXT en tu dominio (Cloudflare DNS):

```
Tipo: TXT
Nombre: _mailchannels
Valor: v=mc1 cfid=tu-pages-project.pages.dev
```

### 5. Desplegar

```bash
npm run deploy
```

### 6. Conectar dominio

En el dashboard de Cloudflare Pages > Custom Domains > agregar `raceclubhub.com` o `checkin.raceclubhub.com`.

## Desarrollo local

```bash
npm install
npm run dev
```

Esto levanta un servidor local en `http://localhost:3000` con un KV simulado.

## Datos de participantes

El archivo `data/participants.json` tiene el formato:

```json
[
  {
    "dorsal": 254,
    "nombre": "Abraham Aguilera Quiros",
    "categoria": "Máster B Masculino",
    "telefono": "50688887777",
    "email": "abraham@email.com"
  }
]
```

- **telefono**: Número con código de país (506 para Costa Rica). Si solo ponés 8 dígitos, se agrega 506 automáticamente.
- **email**: Opcional. Si no tiene, el botón de email se deshabilita para ese atleta.

## Envío de QR a atletas

### WhatsApp
- Abre una ventana de WhatsApp Web con el mensaje pre-escrito
- Incluye link a la página personal del QR del atleta (`/qr.html?dorsal=XXX`)
- El atleta puede descargar su QR desde ahí

### Email
- Envía un email HTML profesional con botón para ver/descargar el QR
- Usa MailChannels (gratis desde Cloudflare Workers)
- Si el servicio de email no está configurado, abre el cliente de correo local como fallback

### Página personal de QR
Cada atleta recibe un link tipo:
```
https://raceclubhub.com/qr.html?dorsal=254
```
Donde puede ver su QR, descargarlo como imagen, o hacer captura de pantalla.

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/participants` | Lista todos los participantes |
| GET | `/api/participants/:dorsal` | Obtiene un participante |
| POST | `/api/checkin/:dorsal` | Registra check-in |
| POST | `/api/undo-checkin/:dorsal` | Revierte check-in |
| GET | `/api/stats` | Estadísticas de check-in |
| POST | `/api/reset` | Reinicia todos los check-ins |
| POST | `/api/send-email` | Envía email a un participante |
| POST | `/api/send-email-bulk` | Envía email a todos con email |

## Estructura del proyecto

```
triatlon-checkin/
├── public/                    ← Frontend (Cloudflare Pages)
│   ├── index.html             ← App principal
│   ├── qr.html               ← Página personal de QR para atletas
│   ├── styles.css
│   └── app.js
├── functions/                 ← Backend API (Cloudflare Workers)
│   └── api/
│       ├── participants.js
│       ├── participants/[dorsal].js
│       ├── checkin/[dorsal].js
│       ├── undo-checkin/[dorsal].js
│       ├── stats.js
│       ├── reset.js
│       ├── send-email.js
│       └── send-email-bulk.js
├── data/
│   └── participants.json
├── scripts/
│   └── seed-kv.js
├── wrangler.toml
└── package.json
```

## Flujo de uso

1. **Preparación**: Llená los campos `telefono` y `email` en `participants.json`
2. **Subir datos**: Ejecutá el seed para cargar participantes al KV
3. **Enviar QR**: Desde la sección "📤 Enviar QR", enviá los códigos por WhatsApp o Email
4. **Día del evento**: Usá el escáner QR o búsqueda manual para hacer check-in
5. **Seguimiento**: Revisá estadísticas en tiempo real
