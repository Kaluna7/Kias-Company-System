# Menjalankan KIAS di HP lewat ngrok

Agar bisa buka app dari browser HP (Wi‑Fi/kuota), jalankan dev server lalu tunnel dengan ngrok.

## 1. Install ngrok (sekali saja)

- Download: https://ngrok.com/download  
- Atau pakai npm: `npm install -g ngrok`  
- Daftar akun gratis di ngrok.com dan dapatkan authtoken, lalu:  
  `ngrok config add-authtoken <token>`

## 2. Jalankan dev server

Di terminal pertama:

```bash
npm run dev
```

Tunggu sampai ada pesan seperti: `Ready on http://localhost:3000`.

## 3. Jalankan ngrok

Di terminal kedua (folder project yang sama):

```bash
npm run ngrok
```

Atau langsung:

```bash
npx ngrok http 3000
```

Atau kalau ngrok sudah di-install global:

```bash
ngrok http 3000
```

## 4. Buka dari HP

- Di output ngrok akan ada URL **HTTPS**, contoh:  
  `https://abc123.ngrok-free.app`
- Buka URL itu di browser HP (pastikan HP dan laptop satu jaringan atau ngrok bisa akses laptop).

## 5. (Penting) Kalau pakai login (NextAuth)

Agar login/callback dari HP tidak error, set URL ngrok sebagai base URL auth:

1. Copy URL HTTPS dari ngrok (misal: `https://abc123.ngrok-free.app`).
2. Di folder project, buat atau edit `.env.local`:
   ```env
   NEXTAUTH_URL=https://abc123.ngrok-free.app
   ```
3. Setiap kali ganti URL ngrok (misal ganti session), update lagi `NEXTAUTH_URL` di `.env.local` dan restart:
   ```bash
   npm run dev
   ```

## Ringkasan perintah

| Langkah        | Perintah          |
|----------------|-------------------|
| Dev server     | `npm run dev`     |
| Tunnel ngrok   | `npm run ngrok`   |
| Buka di HP     | URL HTTPS dari ngrok |

## Troubleshooting

- **“Invalid Host header”**  
  Pastikan di `next.config.mjs` sudah ada `allowedDevOrigins` untuk `*.ngrok-free.app` / `*.ngrok.io` (sudah ditambahkan di project ini).

- **Login redirect salah**  
  Pastikan `NEXTAUTH_URL` di `.env.local` persis sama dengan URL HTTPS ngrok (tanpa slash di akhir).

- **HP tidak bisa akses**  
  Pastikan ngrok masih jalan di laptop dan URL yang dibuka di HP sama dengan yang tampil di terminal ngrok.
