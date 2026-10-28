# LRCMIS — Laundry Reservation & Customer Management Information System

Aplikasi full-stack untuk kebutuhan akademik LRCMIS: reservasi pelanggan dengan kapasitas slot
yang aman terhadap request bersamaan, alur operasional dari penimbangan sampai pengantaran,
pembayaran yang dapat diaudit, promosi, laporan, chat, dan dashboard berbasis role.

- **Frontend:** React 19, Vite 6, TypeScript, Tailwind CSS, React Router, Zod, Recharts, Lucide
- **Backend:** Node.js, Express 4, TypeScript, Prisma 6, PostgreSQL 17, Zod, Vitest + Supertest
- **Auth:** cookie JWT HttpOnly, CSRF double-submit, hash bcrypt, RBAC + ownership check
- **Email:** Resend untuk email reset password
- **Locale:** UI Indonesia, mata uang IDR, zona waktu bisnis `Asia/Jakarta`

---

## 1. Ringkasan fitur

### Publik

- Landing page, daftar layanan, alur pemesanan, kontak, dan ulasan unggulan.
- Register, login, lupa password, dan reset password.
- Reset password dikirim melalui email Resend. Token reset tidak pernah ditampilkan di browser
  pada konfigurasi production.

### Pelanggan

- Dashboard, status pesanan aktif, dan notifikasi.
- Reservasi: pilih layanan, metode pickup, alamat, slot, lalu konfirmasi.
- Pembatalan reservasi dengan batas waktu yang dapat dikonfigurasi.
- Daftar pesanan, detail pesanan, rincian harga, status pembayaran, dan timeline.
- Riwayat pembayaran dan instruksi pembayaran.
- Promosi, validasi voucher, ulasan, komplain, profil, buku alamat, dan ubah password.
- Chat dengan admin. Chat dengan kurir tersedia selama pesanan dalam proses pengantaran.

### Admin

- Dashboard operasional, tren pendapatan, antrean, dan konfirmasi reservasi cepat.
- Reservasi: filter, konfirmasi, pembatalan, dan konversi menjadi order.
- Order: penerimaan/penimbangan, voucher, penugasan staff, perubahan status, catatan internal,
  dan task pengantaran.
- Pembayaran: catat tunai/transfer, verifikasi, tolak, dan refund.
- Penugasan task pickup/delivery ke kurir.
- Data pelanggan, layanan, slot waktu, promosi, komplain, dan ulasan.
- Laporan: pendapatan, order, layanan, pelanggan, operasional, dan ekspor CSV.
- Audit log dan pengelolaan akun.
- Chat dengan pelanggan, staff, dan kurir.

### Staff

- Board produksi berisi order yang ditugaskan.
- Perubahan status hanya ke target yang diizinkan dan hanya untuk order yang ditugaskan.
- Detail order dibatasi berdasarkan kepemilikan/penugasan.

### Kurir

- Daftar task pickup/delivery yang ditugaskan.
- Transisi terima → mulai → selesai/gagal.
- Konfirmasi penerima, snapshot alamat, tautan telepon, dan chat pelanggan saat pengantaran.

### Owner

- Dashboard bisnis, laporan, dan ekspor CSV dalam mode read-only.

---

## 2. Arsitektur singkat

```text
Browser
  │
  ├── Development: Vite :5173 ──proxy /api──> Express :4000 ──> PostgreSQL
  │
  └── Production: Caddy :443 ──> Nginx/web :8080 ──/api──> Express :4000 ──> PostgreSQL
```

Pada Docker Compose:

- `web` menjalankan Nginx dan menyajikan hasil build React.
- Nginx meneruskan `/api/` ke service `server` tanpa mengubah prefix.
- `server` menjalankan migrasi Prisma saat start, seed referensi opsional, lalu API.
- `db` adalah PostgreSQL 17 dengan volume persisten.
- Hanya `web` yang perlu diakses dari luar. API dan database di-bind ke `127.0.0.1` secara default.

---

## 3. Quick start lokal (tanpa Docker)

### Prasyarat

- Node.js 20+ (diuji dengan Node 24)
- PostgreSQL 15+ (diuji dengan PostgreSQL 17)
- npm

Di Arch Linux:

```bash
sudo pacman -S --needed nodejs npm postgresql
sudo systemctl enable --now postgresql
```

### Langkah

```bash
# 1. Install dependency seluruh workspace
npm install

# 2. Buat database development dan test
createdb -U postgres lrcmis_dev
createdb -U postgres lrcmis_test

# 3. Buat environment backend
cp server/.env.example server/.env
# Windows: copy server\.env.example server\.env
# Edit DATABASE_URL dan JWT_SECRET di server/.env

# 4. Generate Prisma client, jalankan migrasi, lalu seed referensi
npm run db:generate
npm run db:deploy
npm run db:seed

# 5. Buat administrator utama (password dicetak sekali)
npm run db:setup-admin -- --email admin@lrcmis.id

# 6. Jalankan backend dan frontend
npm run dev
```

Cara yang lebih stabil untuk development: jalankan dua terminal terpisah.

```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev:client
```

Alamat lokal:

- Web: <http://localhost:5173>
- API: <http://localhost:4000>
- Health check: <http://localhost:4000/api/v1/health>
- Swagger UI: <http://localhost:4000/api/docs>
- OpenAPI JSON: <http://localhost:4000/api/docs.json>

Di Windows PowerShell, gunakan `npm.cmd` jika `npm.ps1` diblokir execution policy.

### Administrator utama

Seed biasa **tidak membuat akun user**. Seed hanya meng-upsert role, layanan, slot masa depan,
dan promosi.

```bash
# Buat atau verifikasi administrator utama
npm run db:setup-admin -- --email admin@lrcmis.id

# Rotasi password administrator utama
npm run db:setup-admin -- --email admin@lrcmis.id --reset-password
```

Akun ditandai `is_primary_admin` di database. Hanya boleh ada satu administrator utama. Database
trigger mencegah penghapusan, penonaktifan, pelepasan role admin, dan penghapusan status primary
admin.

Akun demo lama dapat di-soft-delete satu kali:

```bash
npm run db:cleanup-demo
```

Perintah tersebut hanya menyentuh allowlist email demo lama. Order, pembayaran, reservasi, dan
audit log tetap disimpan. Administrator utama dan akun sah tidak disentuh.

---

## 4. Konfigurasi environment

### Development (`server/.env`)

| Variabel | Fungsi | Default |
| --- | --- | --- |
| `NODE_ENV` | Mode runtime | `development` |
| `PORT` | Port API | `4000` |
| `DATABASE_URL` | Koneksi PostgreSQL | wajib |
| `JWT_SECRET` | Secret JWT, minimal 32 karakter | wajib |
| `JWT_EXPIRES_IN` | Masa berlaku sesi | `8h` |
| `CLIENT_ORIGIN` | Origin frontend yang diizinkan | `http://localhost:5173` |
| `PUBLIC_APP_URL` | Origin publik untuk link di email | ikut `CLIENT_ORIGIN` pertama |
| `COOKIE_SECURE` | Cookie hanya untuk HTTPS | `false` |
| `BUSINESS_TIMEZONE` | Zona waktu bisnis | `Asia/Jakarta` |
| `MIN_WEIGHT_KG` | Berat minimum yang ditagih | `3` |
| `WEIGHT_ROUNDING_KG` | Pembulatan berat ke atas | `0.5` |
| `DEFAULT_DELIVERY_FEE` | Biaya pickup/delivery (IDR) | `5000` |
| `RESERVATION_CANCEL_CUTOFF_HOURS` | Batas pembatalan pelanggan | `2` |
| `EXPOSE_RESET_TOKEN` | Kembalikan token reset di response API | `false` |
| `EMAIL_PROVIDER_API_KEY` | API key Resend | opsional di dev |
| `EMAIL_FROM` | Pengirim email pada domain terverifikasi | opsional di dev |
| `WHATSAPP_API_URL` / `WHATSAPP_API_TOKEN` | Integrasi WhatsApp opsional | kosong |
| `PAYMENT_GATEWAY_KEY` | Reserved untuk payment gateway | kosong |
| `PRIMARY_ADMIN_EMAIL` | Email admin untuk script setup | `admin@lrcmis.id` |
| `PRIMARY_ADMIN_NAME` | Nama admin untuk script setup | `Administrator Utama` |
| `PRIMARY_ADMIN_PASSWORD` | Password eksplisit untuk script setup | dibuat otomatis |

`EXPOSE_RESET_TOKEN` sekarang **false** dan harus tetap false. Reset password menggunakan email.

### Docker Compose (file `.env` di root proyek)

Untuk Docker, gunakan `.env.docker.example` sebagai template. Jangan memakai `server/.env` untuk
Compose karena Compose membaca `.env` dari root proyek.

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `NODE_ENV` | ya | Gunakan `production` di server |
| `JWT_SECRET` | ya | Minimal 32 karakter, bukan nilai contoh |
| `POSTGRES_DB` / `POSTGRES_USER` | tidak | Default `lrcmis` |
| `POSTGRES_PASSWORD` | ya | Gunakan random hex agar aman di `DATABASE_URL` |
| `CLIENT_ORIGIN` | ya | Origin web, boleh dipisah koma: `https://laundry.kisaragilice.my.id,http://192.168.1.10:9999` |
| `PUBLIC_APP_URL` | ya untuk email | Domain publik untuk link reset: `https://laundry.kisaragilice.my.id` |
| `COOKIE_SECURE` | ya | `true` untuk deployment HTTPS; atribut Secure dipilih otomatis per request |
| `EXPOSE_RESET_TOKEN` | ya | Harus `false` |
| `EMAIL_PROVIDER_API_KEY` | ya di production | API key Resend |
| `EMAIL_FROM` | ya di production | Harus memakai domain terverifikasi |
| `WEB_BIND` | tidak | Default `127.0.0.1` |
| `WEB_PORT` | tidak | Default `8080` |
| `API_PORT` | tidak | Default `4000`, bind localhost |
| `POSTGRES_PORT` | tidak | Default `5433`, bind localhost |
| `RUN_SEED` | tidak | Default `true`; seed referensi idempotent |

Pada `NODE_ENV=production`, API menolak start jika:

- `JWT_SECRET` masih memakai nilai contoh,
- `COOKIE_SECURE=false` padahal seluruh `CLIENT_ORIGIN` memakai HTTPS,
- `EXPOSE_RESET_TOKEN` bukan `false`,
- `EMAIL_PROVIDER_API_KEY` atau `EMAIL_FROM` kosong.

`COOKIE_SECURE=false` tetap diizinkan bila ada origin `http://` (misalnya homelab LAN tanpa
domain).

Atribut `Secure` pada cookie sebenarnya dipilih otomatis dari request: login lewat HTTPS mendapat
cookie `Secure`, login lewat HTTP LAN mendapat cookie biasa. Jadi satu deployment bisa diakses
dari `https://domain-anda` sekaligus `http://192.168.1.10:9999` tanpa saling merusak sesi. Untuk
deployment yang bisa diakses dari internet, tetap pakai HTTPS dan `COOKIE_SECURE=true`.

Jika salah satu syarat tidak terpenuhi, container `server` akan restart terus dan request API dari
web akan menghasilkan **502**.

Origin yang sama dengan host request (UI dan `/api` lewat Nginx yang sama) selalu diterima, jadi
mengganti IP LAN atau port web tidak memerlukan perubahan `CLIENT_ORIGIN`. Daftar
`CLIENT_ORIGIN` hanya diperlukan jika frontend dan API benar-benar berbeda origin.

Link di email memakai `PUBLIC_APP_URL`, bukan `CLIENT_ORIGIN`. Saat memakai Cloudflare Tunnel,
atur keduanya ke domain publik agar link reset tidak memakai IP LAN.

---

## 5. Reset password dan Resend

Alur yang digunakan:

1. Pengguna mengirim email melalui halaman lupa password.
2. API selalu memberi respons generik agar akun tidak bisa dienumerasi.
3. Jika akun aktif ditemukan, API membuat token acak, menyimpan **hash** token, dan mengirim
   tautan `https://domain-anda/reset-password?token=...` melalui Resend.
4. Token berlaku selama **1 jam**, hanya dapat dipakai sekali, dan token tidak dicatat di log.
5. Halaman reset meminta password baru, lalu token dihapus/ditandai terpakai.

Konfigurasi Resend:

```env
EMAIL_PROVIDER_API_KEY=re_xxxxxxxxxxxxxxxxx
EMAIL_FROM="LRC MIS <server@kisaragilice.my.id>"
PUBLIC_APP_URL=https://laundry.kisaragilice.my.id
CLIENT_ORIGIN=https://laundry.kisaragilice.my.id
```

Pastikan:

- Domain pengirim sudah terverifikasi di Resend.
- `EMAIL_FROM` memakai alamat pada domain yang terverifikasi.
- DNS SPF/DKIM Resend sudah aktif.
- `PUBLIC_APP_URL` memakai domain publik yang dibuka pengguna, bukan IP LAN/localhost.
- `CLIENT_ORIGIN` sama persis dengan origin web, tanpa trailing slash.

Untuk pengujian di development, `EXPOSE_RESET_TOKEN=false` tetap digunakan. Jangan mengaktifkan
fallback token di server production.

---

## 6. Docker Compose

Compose menyediakan empat service:

- `db` — PostgreSQL 17, volume `lrcmis_pgdata`.
- `server` — API, migrasi otomatis, seed referensi opsional.
- `web` — Nginx + SPA, proxy `/api`.
- `seed` — service satu kali untuk refresh reference data.

### Menjalankan di lokal dengan Docker

```bash
cp .env.docker.example .env
chmod 600 .env
```

Isi minimum di `.env` untuk mencoba di satu mesin lewat HTTP:

```env
NODE_ENV=development
COOKIE_SECURE=false
CLIENT_ORIGIN=http://localhost:8080
PUBLIC_APP_URL=http://localhost:8080
JWT_SECRET=<openssl rand -hex 48>
POSTGRES_PASSWORD=<openssl rand -hex 24>
WEB_BIND=127.0.0.1
WEB_PORT=8080
EXPOSE_RESET_TOKEN=false
```

Lalu:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f server
```

Akses web di <http://localhost:8080>. API tidak perlu dibuka langsung; Nginx sudah mem-proxy
`/api/`.

### Homelab headless: akses dari perangkat lain di LAN

Mesin headless biasanya diakses dari laptop/HP, bukan dari `localhost`. Ubah `.env`:

```env
NODE_ENV=production
# Boleh tetap true meskipun LAN memakai HTTP. Server memilih atribut Secure
# otomatis: request HTTPS mendapat cookie Secure, request HTTP tidak.
COOKIE_SECURE=true
CLIENT_ORIGIN=http://192.168.1.10:9999,http://localhost:9999
PUBLIC_APP_URL=http://192.168.1.10:9999
WEB_BIND=0.0.0.0
WEB_PORT=9999
# production mewajibkan email reset password
EMAIL_PROVIDER_API_KEY=<api-key-resend>
EMAIL_FROM="LRC MIS <server@domain-terverifikasi>"
```

Ganti `192.168.1.10` dengan IP LAN mesin (`ip -4 addr show`). Akses web di
`http://192.168.1.10:9999`. Karena UI dan `/api` berada di origin yang sama, mengganti IP atau
port tidak akan memicu error CORS.

Jika mesin juga punya domain publik lewat Cloudflare Tunnel, pakai
`PUBLIC_APP_URL=https://domain-anda` dan tambahkan domain tersebut ke `CLIENT_ORIGIN`. Satu
deployment bisa melayani HTTPS publik dan HTTP LAN sekaligus.

Jika tidak ingin mengonfigurasi Resend, gunakan `NODE_ENV=development` untuk homelab LAN. Mode ini
melewati validasi email production, tetapi jangan dipakai untuk deployment yang terbuka ke
internet.

Batasi akses port web dengan firewall host, misalnya:

```bash
sudo ufw allow from 192.168.1.0/24 to any port 9999 proto tcp
```

Jangan buka port `4000` (API) atau `5433` (PostgreSQL) ke LAN; keduanya sengaja di-bind ke
`127.0.0.1`.

### Homelab dengan Cloudflare Tunnel dan domain publik

Cloudflare Tunnel hanya meneruskan HTTP. **Link reset password tidak otomatis mengikuti domain
tunnel**; aplikasi tetap memakai `PUBLIC_APP_URL`. Jadi untuk domain
`laundry.kisaragilice.my.id`:

```env
NODE_ENV=production
COOKIE_SECURE=true
CLIENT_ORIGIN=https://laundry.kisaragilice.my.id
PUBLIC_APP_URL=https://laundry.kisaragilice.my.id
WEB_BIND=127.0.0.1
WEB_PORT=9999
EMAIL_PROVIDER_API_KEY=<api-key-resend>
EMAIL_FROM="LRC MIS <server@kisaragilice.my.id>"
```

Jika cloudflared berjalan di host yang sama, arahkan tunnel ke
`http://127.0.0.1:9999`. Jika cloudflared berjalan di mesin/container lain, gunakan
`WEB_BIND=0.0.0.0` dan batasi port `9999` lewat firewall, lalu arahkan tunnel ke IP LAN server.

Contoh konfigurasi cloudflared:

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /home/<user>/.cloudflared/<TUNNEL_UUID>.json
ingress:
  - hostname: laundry.kisaragilice.my.id
    service: http://127.0.0.1:9999
  - service: http_status:404
```

Setelah mengubah `.env`, recreate API:

```bash
docker compose up -d --force-recreate server
docker compose exec server sh -c 'echo "PUBLIC_APP_URL=$PUBLIC_APP_URL"; echo "CLIENT_ORIGIN=$CLIENT_ORIGIN"'
```

Nilai `PUBLIC_APP_URL` harus domain HTTPS publik, bukan `192.168.x.x` atau `localhost`.

Membuat administrator di container:

```bash
docker compose exec server node dist/prisma/setup-primary-admin.js --email admin@lrcmis.id
```

Password awal dicetak satu kali. Untuk menentukan password sendiri:

```bash
docker compose exec -e PRIMARY_ADMIN_PASSWORD='Ganti-Dengan-Password-Kuat-123' \
  server node dist/prisma/setup-primary-admin.js --email admin@lrcmis.id
```

Refresh reference data secara manual:

```bash
docker compose run --rm --build seed
```

`--build` wajib dipakai bila image `seed` belum pernah dibuat atau sudah lama. Service ini berada
di profile `tools`, jadi tidak ikut dibangun oleh `docker compose up -d --build`; tanpa `--build`
perintah dapat memakai image lama dan gagal dengan `spawn tsx ENOENT`.

`seed` tidak membuat akun administrator. Gunakan perintah `setup-primary-admin` di atas.

> **Status verifikasi:** Docker Compose diuji dengan Docker 29.9.2 dan Compose v5.6.1. Build image,
> migrasi Prisma, seed referensi, healthcheck API, login melalui Nginx, dan request API setelah
> container `server` dibuat ulang berhasil tanpa 502. Jalur yang diverifikasi di mesin homelab:
> LAN HTTP dan simulasi HTTPS. Cookie otomatis non-Secure untuk HTTP dan Secure untuk HTTPS,
> sehingga satu deployment aman dipakai lewat domain publik maupun IP LAN.

---

## 7. Instalasi production di Arch Linux dengan Docker

Bagian ini adalah tutorial lengkap untuk server Arch Linux. Contoh domain yang dipakai:

- Domain web: `laundry.kisaragilice.my.id`
- Email pengirim: `server@kisaragilice.my.id`

Ganti domain tersebut dengan domain Anda.

### 7.1 Topologi yang dipakai

```text
Internet :80/:443
        │
        ▼
Caddy di host Arch Linux
        │ reverse_proxy 127.0.0.1:8080
        ▼
lrcmis-web (Nginx + React)
        │ /api
        ▼
lrcmis-api (Express) :4000
        │
        ▼
lrcmis-db (PostgreSQL 17)
```

Caddy menangani HTTPS otomatis. API dan database tidak diekspos ke internet.

### 7.2 Update sistem dan install paket

```bash
sudo pacman -Syu --needed docker docker-compose git caddy openssl ufw
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
newgrp docker

docker --version
docker compose version
```

Jika `newgrp` belum efektif, logout lalu login kembali melalui SSH.

### 7.3 Siapkan firewall

Sesuaikan jika server memakai nftables/firewalld, bukan UFW.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Port `4000`, `5433`, dan `8080` tidak perlu dibuka ke publik karena hanya di-bind ke localhost.

### 7.4 Arahkan DNS

Di penyedia DNS, buat record:

```text
Type  Name   Value
A     lrcmis <IP_PUBLIK_SERVER>
```

Jika memakai IPv6, tambahkan `AAAA` yang benar. Jangan aktifkan proxy/CDN yang menghalangi
validasi HTTP-01 Caddy pada percobaan pertama, kecuali Anda memang mengonfigurasi mode SSL yang
sesuai.

### 7.5 Ambil project

```bash
sudo mkdir -p /opt/lrcmis
sudo chown "$USER":"$USER" /opt/lrcmis

git clone <URL_REPOSITORY_ANDA> /opt/lrcmis
cd /opt/lrcmis
```

Jika tidak memakai Git, unggah project dengan `rsync`/`scp` ke `/opt/lrcmis`.

### 7.6 Buat file `.env` production

```bash
cd /opt/lrcmis
cp .env.docker.example .env
chmod 600 .env
```

Buat nilai acak:

```bash
echo "JWT_SECRET=$(openssl rand -hex 48)"
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
```

Edit `.env`:

```env
NODE_ENV=production
JWT_SECRET=<hasil-openssl-rand-hex-48>
JWT_EXPIRES_IN=8h

COOKIE_SECURE=true
CLIENT_ORIGIN=https://laundry.kisaragilice.my.id
PUBLIC_APP_URL=https://laundry.kisaragilice.my.id

POSTGRES_DB=lrcmis
POSTGRES_USER=lrcmis
POSTGRES_PASSWORD=<hasil-openssl-rand-hex-24>
POSTGRES_PORT=5433

API_PORT=4000
WEB_BIND=127.0.0.1
WEB_PORT=8080

EXPOSE_RESET_TOKEN=false
EMAIL_PROVIDER_API_KEY=re_xxxxxxxxxxxxxxxxx
EMAIL_FROM="LRC MIS <server@kisaragilice.my.id>"
RUN_SEED=true
```

Jangan memakai password database yang mengandung karakter khusus seperti `@`, `:`, `/`, atau `#`
tanpa URL-encoding. Random hex menghindari masalah tersebut.

> **Sudah pernah menjalankan Compose versi lama?** Volume PostgreSQL lama dibuat dengan password
> `lrcmis`. Mengganti `POSTGRES_PASSWORD` di `.env` tidak otomatis mengubah password user di
> database lama, sehingga API akan gagal connect. Pilih salah satu:
>
> ```bash
> # Opsi aman: ubah password user database agar sama dengan .env baru
> docker compose up -d db
> docker compose exec db psql -U lrcmis -d postgres \
>   -c "ALTER USER lrcmis WITH PASSWORD '<POSTGRES_PASSWORD_DARI_ENV>';"
> docker compose up -d --build
> ```
>
> Jangan menghapus volume `lrcmis_pgdata` kecuali Anda memang siap kehilangan seluruh data.

### 7.7 Build dan jalankan container

```bash
cd /opt/lrcmis
docker compose config >/dev/null
docker compose up -d --build
docker compose ps
docker compose logs -f server
```

Perhatikan log `server`. Container harus menampilkan pesan migrasi, seed (jika `RUN_SEED=true`),
lalu `LRCMIS API listening`. Tekan `Ctrl+C` untuk keluar dari tampilan log tanpa mematikan
container.

Jika container `server` restart terus, lihat:

```bash
docker compose logs --tail=100 server
```

Penyebab paling umum adalah `.env` production belum lengkap.

### 7.8 Buat administrator utama

Setelah `server` sehat:

```bash
cd /opt/lrcmis
docker compose exec server node dist/prisma/setup-primary-admin.js \
  --email admin@kisaragilice.my.id
```

Password awal akan dicetak satu kali. Simpan dengan aman dan segera ganti setelah login pertama.
Untuk merotasi password:

```bash
docker compose exec server node dist/prisma/setup-primary-admin.js \
  --email admin@kisaragilice.my.id --reset-password
```

Ini adalah langkah yang benar untuk membuat admin. Service `seed` hanya me-refresh data referensi
dan tidak membuat akun.

### 7.9 Konfigurasi Caddy dan HTTPS

Edit `/etc/caddy/Caddyfile`:

```caddyfile
laundry.kisaragilice.my.id {
    encode gzip
    reverse_proxy 127.0.0.1:8080
}
```

Validasi dan jalankan:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

Caddy akan meminta sertifikat TLS otomatis. Pastikan port 80 dan 443 terbuka serta DNS sudah
mengarah ke server.

### 7.10 Cloudflare Tunnel (alternatif Caddy)

Jika server homelab tidak punya IP publik dan Anda memakai Cloudflare Tunnel, Caddy tidak perlu
dipasang. Tunnel hanya meneruskan request; link email tetap ditentukan oleh `PUBLIC_APP_URL`.

Pastikan `.env` berisi:

```env
COOKIE_SECURE=true
CLIENT_ORIGIN=https://laundry.kisaragilice.my.id
PUBLIC_APP_URL=https://laundry.kisaragilice.my.id
WEB_BIND=127.0.0.1
WEB_PORT=9999
```

Buat tunnel dan DNS (ganti `lrcmis` dengan nama tunnel Anda):

```bash
cloudflared tunnel login
cloudflared tunnel create lrcmis
cloudflared tunnel route dns lrcmis laundry.kisaragilice.my.id
```

Contoh `/etc/cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /etc/cloudflared/<TUNNEL_UUID>.json
ingress:
  - hostname: laundry.kisaragilice.my.id
    service: http://127.0.0.1:9999
  - service: http_status:404
```

Salin file credential ke lokasi yang bisa dibaca service cloudflared, lalu jalankan:

```bash
sudo mkdir -p /etc/cloudflared
sudo cp ~/.cloudflared/<TUNNEL_UUID>.json /etc/cloudflared/
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared --no-pager
```

Jika cloudflared berjalan di mesin/container lain, ubah `WEB_BIND=0.0.0.0`, batasi port web lewat
firewall, dan arahkan `service` tunnel ke IP LAN server.

Verifikasi:

```bash
curl -fsS https://laundry.kisaragilice.my.id/api/v1/health
docker compose exec server sh -c 'echo "PUBLIC_APP_URL=$PUBLIC_APP_URL"'
```

Link reset password harus memakai `https://laundry.kisaragilice.my.id`, bukan IP lokal.

### 7.11 Verifikasi

```bash
# Dari server
curl -fsS http://127.0.0.1:8080/api/v1/health
curl -fsS https://laundry.kisaragilice.my.id/api/v1/health

# Status container
docker compose ps

# Log web dan API
docker compose logs --tail=50 web
docker compose logs --tail=100 server
```

Buka `https://laundry.kisaragilice.my.id`, login sebagai admin, lalu uji:

- login dan logout,
- buat reservasi sebagai pelanggan,
- reset password dan pastikan email Resend masuk,
- chat,
- laporan/CSV,
- refresh halaman dalam keadaan login.

### 7.12 Update aplikasi

Backup database terlebih dahulu:

```bash
cd /opt/lrcmis
mkdir -p backups
chmod 700 backups
docker compose exec -T db pg_dump -U lrcmis -d lrcmis -Fc \
  > "backups/lrcmis-$(date +%F-%H%M).dump"
```

Lalu update:

```bash
cd /opt/lrcmis
git pull --ff-only
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 server
```

Migrasi baru dijalankan otomatis oleh entrypoint `server`.

### 7.13 Backup dan restore

Backup database:

```bash
cd /opt/lrcmis
mkdir -p backups
docker compose exec -T db pg_dump -U lrcmis -d lrcmis -Fc \
  > "backups/lrcmis-$(date +%F-%H%M).dump"
```

Restore:

```bash
cd /opt/lrcmis
docker compose stop web server
docker compose exec -T db pg_restore -U lrcmis -d lrcmis \
  --clean --if-exists --no-owner < backups/lrcmis-2026-01-01-0300.dump
docker compose start server web
```

Amankan juga file `.env` karena berisi secret. Simpan backup di luar server dan enkripsi jika
berisi data pelanggan.

Contoh cron harian (sesuaikan path dan retensi):

```cron
0 3 * * * cd /opt/lrcmis && docker compose exec -T db pg_dump -U lrcmis -d lrcmis -Fc > backups/lrcmis-$(date +\%F).dump
```

### 7.14 Troubleshooting Docker di Arch

**Login/API menghasilkan `Permintaan gagal (502)`**

502 berarti Nginx tidak mendapat respons dari API. Periksa:

```bash
docker compose ps
docker compose logs --tail=150 server
```

Biasanya `server` tidak pernah benar-benar start karena environment production tidak valid:

- `JWT_SECRET` masih memakai nilai contoh,
- `COOKIE_SECURE=false` padahal `CLIENT_ORIGIN` hanya berisi HTTPS,
- `EXPOSE_RESET_TOKEN=true`,
- `EMAIL_PROVIDER_API_KEY` atau `EMAIL_FROM` kosong.

Catatan: `COOKIE_SECURE=false` **diizinkan** di production jika `CLIENT_ORIGIN` memakai `http://`
(homelab LAN). API hanya menulis peringatan.

Perbaiki `.env`, lalu recreate:

```bash
docker compose up -d --force-recreate server web
docker compose logs -f server
```

**Login gagal (500/403) dengan log `Origin tidak diizinkan oleh CORS`**

Penyebabnya `CLIENT_ORIGIN` tidak cocok dengan alamat yang dibuka di browser. Sejak perbaikan ini,
request same-origin lewat Nginx otomatis diterima, tetapi origin berbeda tetap harus terdaftar:

```env
# pisahkan dengan koma, tanpa trailing slash
CLIENT_ORIGIN=http://192.168.1.10:9999,http://localhost:9999
```

Setelah mengubah `.env`:

```bash
docker compose up -d --force-recreate server
curl -i -X POST http://127.0.0.1:9999/api/v1/auth/login \
  -H 'Origin: http://192.168.1.10:9999' -H 'Content-Type: application/json' \
  --data '{"email":"admin@lrcmis.id","password":"PASSWORD_ANDA"}'
```

**Login seolah berhasil tetapi langsung kembali ke halaman login / semua request 401**

Cookie auth tidak tersimpan. Sejak versi ini atribut `Secure` dipilih otomatis per request, jadi
pastikan browser benar-benar memakai host yang sama untuk halaman dan `/api`. Hapus cookie lama
untuk situs tersebut (DevTools → Application → Cookies → Clear), lalu login ulang.

Cek response login di Network tab: cookie `lrcmis_token` harus punya `HttpOnly; SameSite=Lax` dan
**tidak** punya atribut `Secure` saat halaman dibuka lewat HTTP. Saat lewat HTTPS, cookie harus
punya `Secure`.

Jika memakai domain publik dan LAN sekaligus, pastikan login dan request API tetap pada host yang
sama (jangan campur halaman `https://domain` dengan API `http://IP`).

**Link reset password di email mengarah ke IP lokal, bukan domain**

Link dibuat dari `PUBLIC_APP_URL`. Cloudflare Tunnel/Caddy tidak mengubah nilai tersebut. Cek:

```bash
cd /opt/lrcmis
grep '^PUBLIC_APP_URL=' .env
docker compose exec server sh -c 'echo "$PUBLIC_APP_URL"'
```

Set domain publik:

```env
PUBLIC_APP_URL=https://laundry.kisaragilice.my.id
CLIENT_ORIGIN=https://laundry.kisaragilice.my.id
```

Lalu recreate dan minta email reset baru:

```bash
docker compose up -d --force-recreate server
```

Email yang sudah terlanjur dikirim tidak berubah.

**Web bisa dibuka tetapi semua request API 502**

Cek health API dari host:

```bash
curl -i http://127.0.0.1:4000/api/v1/health
docker compose logs --tail=100 server
```

Jika health gagal, jangan hanya me-restart Nginx; perbaiki container API terlebih dahulu. Nginx
pada image ini sudah memakai resolver Docker dan akan mencari ulang IP API setelah container
dibuat ulang, tetapi API yang crash tetap harus diperbaiki dari log `server`.

**`permission denied while trying to connect to the Docker daemon`**

```bash
sudo usermod -aG docker "$USER"
newgrp docker
# atau logout lalu login ulang
```

**Sertifikat Caddy gagal**

- Pastikan DNS A/AAAA sudah benar.
- Pastikan port 80 dan 443 terbuka.
- Cek `sudo journalctl -u caddy -n 100 --no-pager`.
- Jangan memakai proxy/CDN yang menutup validasi HTTP sebelum sertifikat pertama berhasil.

**`P1001` database unreachable**

```bash
docker compose ps
docker compose logs db
```

Pastikan `POSTGRES_PASSWORD` di `.env` tidak berubah setelah volume database dibuat. Jika password
diubah, sesuaikan user database atau recreate volume (langkah terakhir dan destruktif).

**Reset password tidak masuk**

- Cek `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM`, dan status domain Resend.
- Cek log: `docker compose logs --tail=100 server`.
- Pastikan `CLIENT_ORIGIN` memakai domain HTTPS yang benar.
- Cek folder spam pada email penerima.

---

## 8. Business rules penting

1. **Kapasitas slot aman terhadap concurrency.** Pembuatan reservasi memakai transaksi dan
   `SELECT ... FOR UPDATE` pada baris slot sebelum menghitung reservasi pending/confirmed.
2. **Snapshot harga tidak berubah.** Order menyimpan nama layanan dan harga saat order dibuat.
   Perubahan harga layanan tidak mengubah order lama.
3. **Penimbangan.** Layanan berbasis kg memakai berat aktual; berat minimum dan pembulatan ke atas
   mengikuti konfigurasi. Layanan non-kg dapat disesuaikan saat penerimaan. Pickup menambahkan
   biaya delivery.
4. **Idempotensi pembayaran.** Pembuatan pembayaran membutuhkan `Idempotency-Key`; request ulang
   dengan key dan payload yang sama mengembalikan pembayaran yang sama.
5. **State machine order.** Hanya transisi yang didefinisikan yang diterima. `received` hanya
   melalui endpoint penerimaan/penimbangan. Setiap perubahan menulis history.
6. **Siklus reservasi.** Pending → confirmed → order, atau cancelled/expired. Pembatalan pelanggan
   dibatasi cutoff. Reservasi kedaluwarsa dibersihkan oleh job dan pengecekan saat baca.
7. **Promosi.** Diskon persentase/nominal, minimum pembelian, maksimum diskon, kuota, batas per
   user, dan periode aktif. Redemption dicatat dalam transaksi yang sama dengan penerimaan order.
8. **RBAC dan ownership.** Admin untuk write; owner read-only; pelanggan hanya data sendiri; staff
   hanya order yang ditugaskan; kurir hanya task yang ditugaskan.
9. **Audit.** Mutasi sensitif menulis audit log berisi aktor, aksi, entitas, metadata, IP, dan waktu.
   Ekspor CSV juga dicatat.
10. **Zona waktu.** Tanggal bisnis dan bucket laporan memakai `Asia/Jakarta`.

---

## 9. Chat dan notifikasi

- Chat tersedia untuk pelanggan, admin, staff, dan kurir sesuai konteks.
- Admin dapat memulai percakapan dengan pelanggan, staff, atau kurir.
- Kurir dapat membuka chat pelanggan dari task pengantaran; pembatasan berlaku selama pesanan
  berada pada tahap pengantaran.
- Pesan disimpan di database dan daftar percakapan memakai polling/unread count.
- Notifikasi in-app disimpan di database. Email Resend dan adapter WhatsApp hanya mengirim jika
  dikonfigurasi.
- Rate limit umum cukup tinggi untuk polling dashboard, tetapi tetap membatasi penyalahgunaan.

---

## 10. API overview

Base path: `/api/v1`

| Area | Endpoint representatif |
| --- | --- |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/logout`, `GET /auth/csrf`, `POST /auth/forgot-password`, `/auth/reset-password`, `GET /auth/me` |
| Public | `GET /services`, `/config`, `/reviews/featured` |
| Customer | `GET/POST /reservations`, `GET /reservations/me`, `PATCH /reservations/:id/cancel`, `GET /time-slots`, `GET /orders/me`, `GET /orders/:id`, `GET /payments/me`, `GET /promotions`, `POST /promotions/validate`, `GET/POST /complaints`, `GET /notifications/me` |
| Admin | `/dashboard`, `/reservations`, `/orders`, `/orders/:id/receive`, `/orders/:id/status`, `/orders/:id/payments`, `/payments`, `/delivery-tasks`, `/customers`, `/services`, `/time-slots`, `/promotions`, `/complaints`, `/reviews`, `/reports/*`, `/audit-logs` |
| Staff | `GET /staff/orders`, `GET /staff/orders/:id`, `PATCH /staff/orders/:id/status`, `POST /staff/orders/:id/notes` |
| Courier | `GET /courier/tasks`, `GET /courier/tasks/:id`, `PATCH /courier/tasks/:id/status` |
| Chat | `GET /chat/conversations`, `GET/POST /chat/conversations/:id/messages`, `POST /chat/conversations` |

Format sukses:

```json
{ "success": true, "data": {}, "meta": { "total": 0, "page": 1, "limit": 20, "totalPages": 1 } }
```

Format error:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Input tidak valid", "details": [] } }
```

### Model keamanan

- Cookie JWT `lrcmis_token` HttpOnly; Bearer token didukung untuk tooling.
- Cookie `lrcmis_csrf` yang dapat dibaca client + header `X-CSRF-Token` pada method tidak aman
  (double-submit).
- Endpoint bootstrap login/register/reset password dikecualikan hanya sebelum cookie CSRF ada.
- Helmet, CORS allow-list, batas ukuran JSON, dan rate limiting.
- Zod validation untuk params, query, dan body.
- Password di-hash bcrypt cost 12 dan tidak pernah diserialisasi ke response.
- Rate limit production yang lebih ketat: login 15/15 menit, reset password 5/jam, umum 1200/15
  menit. Development lebih longgar (login 50, reset 30). Counter in-memory sehingga reset saat
  backend restart.
- Request GET di frontend mencoba ulang kegagalan jaringan/5xx sebentar; mutation tidak di-retry
  otomatis untuk mencegah duplikasi.

---

## 11. Database dan migrasi

Entitas inti: user/role, address, service, time slot, reservation, order, order item, status
history, payment, delivery task, promotion/redemption, notification, review, audit log, dan chat
conversation/message.

Beberapa tabel tambahan ditandai `EXT:` pada `server/prisma/schema.prisma`:

- `reservation_items`
- `order_notes`
- `complaint` / `complaint_follow_ups`
- `password_reset_tokens`
- field idempotency/verifikasi/refund pada payment
- `assigned_staff_id` dan catatan order
- snapshot alamat/kontak dan field handover pada delivery task
- `max_discount` dan `per_user_limit` pada promotion
- unique `(order_id, reference_code)` untuk mencegah referensi transfer duplikat

Uang memakai `NUMERIC(12,2)`, primary key UUID, timestamp `TIMESTAMPTZ`, dan tipe `@db.Date` /
`@db.Time` untuk slot.

---

## 12. Testing

Backend memakai PostgreSQL test sungguhan (`lrcmis_test`), bukan mock.

Dengan PostgreSQL lokal:

```bash
# Satu kali
createdb -U postgres lrcmis_test
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lrcmis_test?schema=public" \
  npm run db:deploy -w server

# Jalankan semua
npm test

# Terpisah
npm run test:server
npm run test -w client
```

Dengan PostgreSQL dari Docker Compose (homelab):

```bash
set -a; . ./.env; set +a

# Satu kali: buat database test terpisah
docker compose exec db createdb -U lrcmis lrcmis_test

# Terapkan skema ke lrcmis_test
DATABASE_URL="postgresql://lrcmis:${POSTGRES_PASSWORD}@127.0.0.1:5433/lrcmis_test?schema=public" \
  npx prisma migrate deploy --schema server/prisma/schema.prisma

# Jalankan test backend
TEST_DATABASE_URL="postgresql://lrcmis:${POSTGRES_PASSWORD}@127.0.0.1:5433/lrcmis_test?schema=public" \
  npm run test:server
```

`TEST_DATABASE_URL` dibaca oleh `server/vitest.config.ts`. Suite test melakukan `TRUNCATE` pada
seluruh tabel, jadi **jangan pernah** mengarahkannya ke database `lrcmis` produksi.

Cakupan backend antara lain:

- password salah dan tidak ada kebocoran hash,
- akses tanpa login dan forbidden,
- owner analytics vs penolakan write,
- validation error per field,
- akses order/payment lintas pelanggan,
- kapasitas slot terakhir saat request bersamaan,
- snapshot harga immutable,
- transisi order tidak valid dan staff yang tidak ditugaskan,
- idempotensi pembayaran,
- laporan revenue, ekspor CSV, dan empty period,
- voucher kedaluwarsa/minimum purchase,
- hasil pagination kosong,
- dashboard staff/kurir dan audit log,
- reset password, email provider, dan tidak ada email sungguhan saat test.

Frontend mencakup format IDR/tanggal, schema Zod, rendering design system, dan API helper.

**Hasil terbaru: backend 45 passed, frontend 17 passed.**

---

## 13. Build dan production notes

```bash
npm run build        # build server dan client
npm start            # jalankan API hasil build (server/dist/src/index.js)
```

Client output ada di `client/dist`. API hanya menyajikan `/api/*`; SPA disajikan terpisah melalui
Nginx/Docker web service.

Checklist production:

1. Gunakan `JWT_SECRET` acak yang kuat dan `COOKIE_SECURE=true` di belakang HTTPS.
2. Set `EXPOSE_RESET_TOKEN=false` dan konfigurasi Resend.
3. Batasi `CLIENT_ORIGIN` ke origin web yang benar.
4. Jalankan `prisma migrate deploy` saat deployment (sudah otomatis di Docker).
5. Backup PostgreSQL dan rotasi kredensial secara berkala.
6. Jangan commit `.env`, API key, password database, atau file cookie/token hasil debugging.
7. Pastikan `.env` dan `server/.env` bermode `600` (`chmod 600 .env server/.env`).

---

## 14. Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Jalankan API dan web bersama |
| `npm run dev:server` / `dev:client` | Jalankan satu sisi |
| `npm run build` | Compile server dan build client |
| `npm start` | Jalankan API hasil build |
| `npm test` | Test backend dan frontend |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:migrate` | Buat/terapkan migrasi development |
| `npm run db:deploy` | Terapkan migrasi yang ada |
| `npm run db:seed` | Seed data referensi (idempotent, tanpa user demo) |
| `npm run db:setup-admin` | Buat/verifikasi administrator utama |
| `npm run db:cleanup-demo` | Soft-delete allowlist akun demo lama |
| `npm run db:reset` | Reset database (destruktif) |

---

## 15. Troubleshooting lokal

- **`P1001` database unreachable:** pastikan PostgreSQL berjalan dan port/kredensial di
  `server/.env` benar.
- **`Environment variable not found: DATABASE_URL`:** jalankan perintah Prisma dari `server/`
  atau lewat root script workspace.
- **Cookie tidak tersimpan:** atribut `Secure` dipilih otomatis dari skema request, jadi yang
  penting adalah membuka UI dan API pada host yang sama. Hapus cookie lama lalu login ulang. Akses
  UI lewat origin yang terdaftar di `CLIENT_ORIGIN`; same-origin lewat Nginx diterima otomatis,
  tetapi membuka API langsung dari origin lain akan ditolak.
- **`Token CSRF tidak valid`:** reload aplikasi agar cookie CSRF diperbarui. Helper API frontend
  otomatis mengirim header `X-CSRF-Token`.
- **Test gagal karena database kotor:** suite backend membersihkan database `lrcmis_test` saat
  mulai. Jangan arahkan `DATABASE_URL` test ke database development.
- **`Tidak dapat terhubung ke server`:** biasanya backend/proses dev sedang mati atau restart,
  bukan masalah role. Jalankan backend dan frontend di terminal terpisah, lalu cek health API.
- **`Permintaan gagal (502)` di Docker:** lihat bagian troubleshooting Arch/Docker di atas; hampir
  selalu API container tidak start karena `.env` production tidak valid.

---

## 16. Batasan dan asumsi

- **Payment gateway:** transfer bank dicatat dan diverifikasi manual; tidak ada integrasi gateway
  live atau upload bukti transfer. `PAYMENT_GATEWAY_KEY` masih reserved.
- **Refund:** dicatat sebagai perubahan status akuntansi; tidak memindahkan uang secara eksternal.
- **Notifikasi:** in-app tersimpan. Email (Resend) dan WhatsApp opsional dan hanya mengirim jika
  kredensial diisi; tidak ada worker retry background.
- **Logistik:** alamat berupa teks dengan koordinat opsional; UI membuka Google Maps search, bukan
  optimasi rute.
- **Reservasi vs order:** reservasi menangkap layanan yang diminta; tagihan final dihitung saat
  penerimaan/penimbangan karena layanan kg belum bisa dihargai sebelum ditimbang.
- **Cancellation cutoff** hanya untuk pelanggan; admin dapat membatalkan di luar window jika belum
  ada order.
- **Timezone:** `Asia/Jakarta` adalah satu-satunya zona waktu bisnis.
- **Laporan** mengikuti rentang tanggal yang diminta; beberapa widget dashboard sengaja melihat
  slot mendatang di luar rentang agar tetap berguna secara operasional.
- **Tidak ada file storage:** aplikasi tidak menerima upload gambar; profil/alamat dan referensi
  pembayaran berupa teks.
- **Concurrency** ditegakkan untuk kapasitas slot, idempotensi pembayaran, penerimaan, dan transisi
  task/order melalui row lock. Entitas lain mengandalkan transaksi Prisma dan unique constraint.
