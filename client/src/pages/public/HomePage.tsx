import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Droplets,
  MapPin,
  PackageCheck,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  Wallet,
} from 'lucide-react';
import { Button, Card, EmptyState, ErrorState, LoadingState, SectionTitle } from '../../components/ui';
import { Stars } from '../../components/common';
import { useApi } from '../../lib/useApi';
import { formatCurrency, unitLabel } from '../../lib/format';
import type { AppConfig, Review, Service } from '../../lib/types';

const flow = [
  { icon: Truck, title: 'Pickup', text: 'Kurir menjemput sesuai jadwal.', tone: 'bg-brand-50 text-brand-700' },
  { icon: Droplets, title: 'Cuci', text: 'Dicuci dan dikeringkan.', tone: 'bg-accent-50 text-accent-700' },
  { icon: Sparkles, title: 'Setrika', text: 'Rapi, wangi, siap dipakai.', tone: 'bg-amber-50 text-amber-700' },
  { icon: PackageCheck, title: 'Antar', text: 'Diantar kembali ke alamat.', tone: 'bg-sky-50 text-sky-700' },
];

const values = [
  { icon: Clock, title: 'Jadwal yang pasti', text: 'Kapasitas slot dicek ulang oleh server, jadi jadwal yang Anda pilih benar-benar tersedia.' },
  { icon: Wallet, title: 'Harga transparan', text: 'Rincian layanan, diskon, dan biaya antar terlihat sebelum pembayaran dicatat.' },
  { icon: MapPin, title: 'Antar-jemput', text: 'Pilih drop-off atau pickup. Alamat tersimpan pada reservasi dan tugas kurir.' },
  { icon: ShieldCheck, title: 'Status terlacak', text: 'Setiap perubahan status produksi tercatat pada timeline pesanan Anda.' },
];

const steps = [
  { icon: CalendarCheck, title: 'Pilih layanan & slot', text: 'Tentukan layanan, metode penyerahan, dan waktu yang tersedia.' },
  { icon: Truck, title: 'Antar atau dijemput', text: 'Serahkan cucian di outlet atau tunggu kurir datang.' },
  { icon: Droplets, title: 'Kami proses', text: 'Cucian ditimbang, dihitung, lalu dikerjakan sesuai tahapan.' },
  { icon: PackageCheck, title: 'Terima & nilai', text: 'Bayar tunai atau transfer, lalu beri ulasan setelah selesai.' },
];

export function HomePage() {
  const services = useApi<Service[]>('/services');
  const reviews = useApi<Review[]>('/reviews/featured');
  const config = useApi<AppConfig>('/config');

  const serviceList = services.data ?? [];
  const reviewList = reviews.data ?? [];
  const averageRating = reviewList.length
    ? reviewList.reduce((sum, review) => sum + review.rating, 0) / reviewList.length
    : null;

  return (
    <div>
      <section className="relative overflow-hidden border-b border-ink-100 bg-gradient-to-b from-brand-50 via-[#f3f8ff] to-white">
        <div className="pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-brand-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-accent-200/35 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-10 sm:px-6 lg:px-8 lg:pb-20 lg:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200/80 bg-white/80 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-700 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-500" aria-hidden="true" />
                Reservasi online · Pickup & delivery
              </span>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-ink-950 sm:text-5xl lg:text-[3.6rem]">
                Laundry rapi,
                <br />
                <span className="text-brand-600">tanpa keluar rumah.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-600 sm:text-lg">
                Cuci, setrika, dan antar-jemput dalam satu alur yang terjadwal. Pilih slot, lacak setiap tahap, dan
                bayar setelah tagihan final ditetapkan.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/register">
                  <Button size="lg" icon={<ArrowRight className="h-4 w-4" />}>
                    Reservasi sekarang
                  </Button>
                </Link>
                <Link to="/layanan">
                  <Button variant="outline" size="lg">
                    Cek harga layanan
                  </Button>
                </Link>
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-ink-500">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-accent-600" aria-hidden="true" /> Tanpa biaya pendaftaran
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-accent-600" aria-hidden="true" /> Status pesanan transparan
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-accent-600" aria-hidden="true" /> Tunai atau transfer
                </span>
              </div>

              <dl className="mt-8 grid max-w-lg grid-cols-3 gap-4 border-t border-brand-100 pt-6">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">Layanan aktif</dt>
                  <dd className="mt-1 text-xl font-extrabold text-ink-950">
                    {services.loading ? '—' : serviceList.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">Minimum kiloan</dt>
                  <dd className="mt-1 text-xl font-extrabold text-ink-950">
                    {config.loading ? '—' : `${config.data?.minWeightKg ?? '—'} kg`}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">Biaya antar</dt>
                  <dd className="mt-1 text-xl font-extrabold text-ink-950">
                    {config.loading ? '—' : formatCurrency(config.data?.defaultDeliveryFee ?? 0)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="relative animate-fade-up">
              <div className="rounded-[2rem] border border-brand-100 bg-white/75 p-4 shadow-soft backdrop-blur sm:p-5">
                <div className="flex items-center justify-between gap-3 px-1 pb-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-600">Alur layanan</p>
                    <p className="mt-1 text-sm font-bold text-ink-900">Dari jemput sampai kembali bersih</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-accent-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent-500" aria-hidden="true" /> Terjadwal
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {flow.map((item, index) => (
                    <div key={item.title} className="relative rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
                      <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                        {index + 1}
                      </span>
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.tone}`}>
                        <item.icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <p className="mt-3 text-sm font-bold text-ink-950">{item.title}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{item.text}</p>
                      <div className="mt-3 h-1 overflow-hidden rounded-full bg-ink-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
                          style={{ width: `${45 + index * 15}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-brand-950 px-4 py-3.5 text-white">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <ShieldCheck className="h-4.5 w-4.5 h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold">Kapasitas slot terkunci saat reservasi</p>
                    <p className="mt-0.5 text-[11px] text-brand-100/70">Tidak ada slot ganda. Status tersimpan pada riwayat pesanan.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-ink-100 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-9 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {values.map((value) => (
            <div key={value.title} className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <value.icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold text-ink-900">{value.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-500">{value.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <SectionTitle
          title="Layanan yang siap menemani rutinitas"
          description="Harga jelas per satuan. Untuk layanan kiloan, tagihan mengikuti berat aktual saat cucian diterima."
          action={
            <Link to="/layanan" className="inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:text-brand-900">
              Semua layanan <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          }
        />
        {services.loading ? (
          <div className="mt-8">
            <LoadingState label="Memuat layanan..." />
          </div>
        ) : services.error ? (
          <div className="mt-8">
            <ErrorState message={services.error} onRetry={services.refetch} />
          </div>
        ) : serviceList.length === 0 ? (
          <div className="mt-8">
            <EmptyState title="Belum ada layanan aktif" description="Silakan hubungi admin untuk informasi layanan." />
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {serviceList.slice(0, 6).map((service) => (
              <Card key={service.id} className="group flex flex-col p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Droplets className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="rounded-full bg-sand-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-500">
                    / {unitLabel[service.pricingUnit] ?? service.pricingUnit}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-bold text-ink-950">{service.name}</h3>
                <p className="mt-1 line-clamp-2 flex-1 text-sm leading-relaxed text-ink-500">
                  {service.description || 'Layanan laundry profesional dengan proses yang terjaga.'}
                </p>
                <div className="mt-4 flex items-end justify-between border-t border-ink-100 pt-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Mulai dari</p>
                    <p className="text-lg font-extrabold text-ink-950">{formatCurrency(service.price)}</p>
                  </div>
                  {service.estimatedHours ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sand-50 px-2 py-1 text-[11px] font-semibold text-ink-500">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" /> ±{service.estimatedHours} jam
                    </span>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="border-y border-ink-100 bg-sand-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionTitle
            title="Empat langkah, cucian beres"
            description="Alur yang sama digunakan pelanggan dan tim operasional, sehingga tidak ada informasi yang terputus."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step.title} className="relative rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
                <span className="absolute right-4 top-4 text-3xl font-extrabold text-ink-100">0{index + 1}</span>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
                  <step.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-bold text-ink-950">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-500">{step.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/cara-kerja">
              <Button variant="outline">Pelajari alurnya</Button>
            </Link>
            <Link to="/register">
              <Button icon={<ArrowRight className="h-4 w-4" />}>Buat akun pelanggan</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <span className="eyebrow">Kata pelanggan</span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-950 sm:text-4xl">
              Dipercaya untuk cucian yang sibuk
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-500">
              Ulasan asli dari pelanggan yang telah menyelesaikan pesanan di LRCMIS.
            </p>
            <div className="mt-5 flex items-center gap-4 rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold text-ink-900">
                  {averageRating ? `${averageRating.toFixed(1)} dari 5` : 'Ulasan terverifikasi'}
                </p>
                <p className="text-xs text-ink-500">
                  {reviewList.length > 0
                    ? `${reviewList.length} ulasan terbaru dari pelanggan.`
                    : 'Hanya pelanggan dengan pesanan selesai yang dapat menilai.'}
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {reviews.loading ? (
              <div className="sm:col-span-2">
                <LoadingState label="Memuat ulasan..." />
              </div>
            ) : reviewList.length === 0 ? (
              <Card className="p-6 sm:col-span-2">
                <p className="text-sm font-semibold text-ink-800">Belum ada ulasan yang ditampilkan.</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-500">
                  Ulasan akan muncul di sini setelah pelanggan menyelesaikan pesanan. Jadilah yang pertama berbagi
                  pengalaman setelah laundry Anda selesai.
                </p>
              </Card>
            ) : (
              reviewList.slice(0, 4).map((review) => (
                <Card key={review.id} className="p-5">
                  <Stars value={review.rating} size="sm" />
                  <p className="mt-3 text-sm leading-relaxed text-ink-700">“{review.comment}”</p>
                  <p className="mt-4 text-xs font-bold text-ink-900">{review.customerName}</p>
                  <p className="text-[11px] text-ink-400">{review.service}</p>
                </Card>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="relative overflow-hidden rounded-[2rem] border border-brand-100 bg-brand-50/60 p-6 sm:p-8">
              <div className="absolute inset-0 bg-soft-grid bg-grid opacity-60" aria-hidden="true" />
              <div className="relative">
                <span className="eyebrow">Kunjungi outlet</span>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-950">Antar langsung, tanpa perlu menunggu kurir.</h2>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-600">
                  Outlet menerima drop-off sesuai slot reservasi. Untuk pickup, pastikan alamat dan nomor telepon sudah
                  tersimpan di profil agar kurir dapat menghubungi Anda.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="flex items-start gap-3 rounded-xl bg-white/80 p-4">
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-bold text-ink-900">Alamat outlet</p>
                      <p className="mt-1 text-xs leading-relaxed text-ink-500">Jl. Untung Suropati No.67, Labuhan Ratu, Kec. Kedaton, Kota Bandar Lampung, Lampung 35142</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl bg-white/80 p-4">
                    <Clock className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-bold text-ink-900">Jam operasional</p>
                      <p className="mt-1 text-xs leading-relaxed text-ink-500">Setiap hari, 07.00–21.00 WIB</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl bg-white/80 p-4">
                    <Phone className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-bold text-ink-900">Telepon</p>
                      <a href="tel:+6289834204779" className="mt-1 block text-xs font-semibold text-brand-700 hover:text-brand-900">+62 896 3420 4779</a>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl bg-white/80 p-4">
                    <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-bold text-ink-900">Pembayaran</p>
                      <p className="mt-1 text-xs leading-relaxed text-ink-500">Tunai di outlet atau transfer bank.</p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link to="/kontak"><Button variant="outline">Hubungi kami</Button></Link>
                  <a href="https://maps.app.goo.gl/7nPENqqwSVoLRT7r7" target="_blank" rel="noreferrer">
                    <Button variant="ghost" icon={<MapPin className="h-4 w-4" />}>Buka di Google Maps</Button>
                  </a>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-700 via-brand-600 to-accent-600 p-7 text-white shadow-soft sm:p-9">
              <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
              <div className="relative flex h-full flex-col">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/90">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Siap mencoba?
                </span>
                <h2 className="mt-4 text-3xl font-extrabold leading-tight">Jadwalkan cucian pertama Anda hari ini.</h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-brand-50/80">
                  Buat akun, pilih slot, dan pantau status pesanan dari dashboard. Tidak perlu antre untuk memesan.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Link to="/register">
                    <Button size="lg" variant="light">
                      Daftar sekarang
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button size="lg" variant="ghostLight">
                      Masuk
                    </Button>
                  </Link>
                </div>
                <div className="mt-auto grid grid-cols-3 gap-3 border-t border-white/15 pt-6">
                  <div>
                    <p className="text-lg font-extrabold">{services.loading ? '—' : serviceList.length}</p>
                    <p className="text-[10px] uppercase tracking-wide text-white/60">Layanan</p>
                  </div>
                  <div>
                    <p className="text-lg font-extrabold">{config.data?.weightRoundingKg ?? '—'} kg</p>
                    <p className="text-[10px] uppercase tracking-wide text-white/60">Pembulatan</p>
                  </div>
                  <div>
                    <p className="text-lg font-extrabold">{config.data?.reservationCancelCutoffHours ?? '—'} jam</p>
                    <p className="text-[10px] uppercase tracking-wide text-white/60">Batas batal</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
