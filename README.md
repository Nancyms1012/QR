# 🏊‍♂️🚴‍♂️🏃‍♂️ Race Club Hub - Check-in

Sistema de check-in para triatlón con escaneo de códigos QR, desplegado en Cloudflare Pages + Workers KV.

**URL:** https://raceclubhub.com

## Funcionalidades

- 📷 **Escáner QR** - Escanea el código QR del atleta con la cámara
- 🔍 **Búsqueda manual** - Busca por número de dorsal o nombre
- 📋 **Lista completa** - Filtra por categoría y estado de check-in
- 📊 **Estadísticas** - Progreso de check-in en tiempo real
- 🏷️ **Códigos QR** - Genera e imprime los QR para distribuir

## Arquitectura

| Componente | Tecnología |
|-----------|-----------|
| Frontend | HTML/CSS/JS estático en Cloudflare Pages |
| Backend API | Cloudflare Pages Functions (Workers) |
| Base de datos | Cloudflare Workers KV |
| QR Scanner | html5-qrcode (cámara del dispositivo) |
| QR Generator | qrcode.js (generación client-side) |
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

### 3. Desplegar

```bash
npm run deploy
```

### 4. Conectar dominio

En el dashboard de Cloudflare Pages > Custom Domains > agregar `raceclubhub.com` o `checkin.raceclubhub.com`.

## Desarrollo local

```bash
npm install
npm run dev
```

Esto levanta un servidor local en `http://localhost:3000` con un KV simulado.

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/participants` | Lista todos los participantes |
| GET | `/api/participants/:dorsal` | Obtiene un participante |
| POST | `/api/checkin/:dorsal` | Registra check-in |
| POST | `/api/undo-checkin/:dorsal` | Revierte check-in |
| GET | `/api/stats` | Estadísticas de check-in |
| POST | `/api/reset` | Reinicia todos los check-ins |

## Estructura del proyecto

```
triatlon-checkin/
├── public/              ← Frontend (Cloudflare Pages)
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── functions/           ← Backend API (Cloudflare Workers)
│   └── api/
│       ├── participants.js
│       ├── participants/[dorsal].js
│       ├── checkin/[dorsal].js
│       ├── undo-checkin/[dorsal].js
│       ├── stats.js
│       └── reset.js
├── data/
│   └── participants.json
├── scripts/
│   └── seed-kv.js
├── wrangler.toml
└── package.json
```
