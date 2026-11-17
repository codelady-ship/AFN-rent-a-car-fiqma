# AFN rent a car – full-stack car rental site (practice clone)

[![Live demo](https://img.shields.io/badge/live-GitHub%20Pages-eb571c?style=flat-square)](https://codelady-ship.github.io/AFN-rent-a-car-fiqma/)

A responsive car rental landing page built from the **AFN rent a car Figma design** as a **practice clone (təlim layihəsi)**. The frontend (GitHub Pages) talks to a **Node.js + Express + MongoDB REST API** (`backend/`, deployable to Render) that serves the cars and stores **reservation requests**. If the API is not reachable, the page falls back to static demo data, so the live site never breaks. The car list and prices are sample data.

> AZ: AFN rent a car Figma dizaynı əsasında hazırlanmış full-stack təlim layihəsi: frontend + Express/MongoDB API (avtomobillər, rezervasiya sorğuları, JWT admin). API əlçatan olmayanda sayt statik demo məlumatla işləyir; qiymətlər nümunədir.

![AFN rent a car screenshot](docs/screenshot.png)

## Features

- Hero slider (Swiper) with rental classes; "İndi icarə et" filters the car list.
- Class tiles and category filter buttons (Ekonom, Biznes, Premium, Krossover və SUV, Avtobuslar).
- Car cards rendered from data, with a **"Hamısını göstər" / "Daha az göstər"** toggle (6 cards first).
- **Car detail modal** (native `<dialog>`) with specs and a "reserve this car" button that pre-selects the car in the form.
- Advantages, delivery and reservation sections.
- **Reservation form** with validation (name, phone, car, dates; the return date must be after the pick-up date) and a live price estimate. With the API online the request is saved in MongoDB and the visitor gets a reservation number (e.g. `AFN-3F9A1C`); the server checks the dates, the car's availability and overlapping bookings and calculates the total itself. Offline it shows a demo confirmation.
- **Admin API** (JWT): add, edit and delete cars, list reservation requests and confirm or cancel them.
- Hamburger menu on mobile, `tel:`/`mailto:` links, skip link and keyboard-accessible controls.
- SEO: title, description, canonical, Open Graph/Twitter tags, favicon, `robots.txt`, `sitemap.xml`, alt text on every image.
- Images converted to WebP (largest about 130 KB).

## Tech stack

- **Frontend:** HTML5, CSS3 (Grid, Flexbox, media queries), vanilla JavaScript, [Swiper 10.1.0](https://swiperjs.com/) and [axios 1.7.9](https://axios-http.com/) from jsDelivr (pinned versions).
- **Backend:** Node.js 20+, Express 5, MongoDB with Mongoose 8, zod validation, JWT admin auth, CORS allow-list, rate limiting on public writes and login.
- **Tests:** `node:test` + supertest on an in-memory MongoDB (`mongodb-memory-server`).
- **Hosting:** GitHub Pages (frontend), Render free web service (API, `render.yaml`), MongoDB Atlas free cluster (database).

## Architecture

```
index.html + rentacar.js  ──fetch (8 s timeout)──▶  Express API (backend/, Render)  ──▶  MongoDB Atlas
        │                                                      ▲
        └── if the API is not set or not reachable: backend/rentAcar.json (static demo data, also the seed file)
```

The API URL is set in `config.js` (`window.AFN_API_URL`). For a quick test you can also add `?api=<url>` to the page address.

## REST API

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/health` | public | Status and database connection |
| GET | `/api/slides` | public | Hero slider items |
| GET | `/api/categories` | public | Car classes |
| GET | `/api/cars?category=Ekonom&available=true` | public | Cars, optional filters |
| GET | `/api/cars/:id` | public | One car |
| POST | `/api/reservations` | public (rate limited) | `{ name, phone, car, from, to, place, note }` → `201 { reference, days, total, ... }`; `400` with field errors, `409` if the car is busy on those dates |
| POST | `/api/auth/login` | public (rate limited) | `{ email, password }` → `{ token }` (8 h) |
| POST / PUT / DELETE | `/api/cars`, `/api/cars/:id` | admin | Manage cars |
| GET | `/api/reservations?status=pending` | admin | Latest 200 reservation requests |
| PATCH | `/api/reservations/:id` | admin | `{ status: "pending" | "confirmed" | "cancelled" }` |

Admin calls need the header `Authorization: Bearer <token>`.

## Run locally

Static mode only (the same as GitHub Pages without an API):

```bash
git clone https://github.com/codelady-ship/AFN-rent-a-car-fiqma.git
cd AFN-rent-a-car-fiqma
npx serve .            # open the printed URL
```

Full stack (needs a MongoDB: a free Atlas cluster or a local `mongod`):

```bash
cd backend
cp .env.example .env   # fill MONGODB_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm install
npm run dev            # API on http://localhost:4000, empty collections are seeded from rentAcar.json
npm test               # API tests (in-memory MongoDB, no setup needed)
```

In a second terminal run `npx serve . -l 3000` in the project root and open `http://localhost:3000/?api=http://localhost:4000`.
`npm run seed -- --reset` reloads cars, categories and slides from `rentAcar.json` (reservations are kept).

## Deployment

- **Frontend:** GitHub Pages serves the `main` branch from the repository root: https://codelady-ship.github.io/AFN-rent-a-car-fiqma/. The old address `rentacar.html` redirects to the root.
- **Database:** create a free MongoDB Atlas M0 cluster, a database user and allow access from anywhere (`0.0.0.0/0`, Render has no fixed IP on the free plan). Copy the connection string.
- **API:** on Render choose *New → Blueprint* and select this repository; `render.yaml` creates the free web service `afn-rent-a-car-api` from `backend/`. Fill `MONGODB_URI`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` when asked (`JWT_SECRET` is generated). The first start seeds the data.
- **Connect:** put the Render URL into `config.js` (`window.AFN_API_URL = "https://afn-rent-a-car-api.onrender.com"`) and push to `main`.

The free Render service sleeps after 15 minutes without traffic; the first request can take up to a minute. During that time the page shows the static data and the form works in demo mode.

## What I learned

- Designing a small REST API with Express and Mongoose: models, validation, error handling and admin-only routes with JWT.
- Doing the important checks (dates, overlapping bookings, price) on the server instead of trusting the browser.
- Testing an API with supertest against an in-memory database.
- Loading and rendering data with axios, and falling back from an API to a static file.
- Building filters, a show-all toggle and a modal without a framework.
- Form validation with clear error messages and `aria-invalid`.
- Replacing a duplicated CSS framework setup with a small custom stylesheet.
