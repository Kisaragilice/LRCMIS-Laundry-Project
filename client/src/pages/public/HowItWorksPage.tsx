import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck, CheckCircle2, Clock, Droplets, MapPin, PackageCheck, ShieldCheck, Truck } from 'lucide-react';
import { Button, Card } from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { formatCurrency } from '../../lib/format';
import type { AppConfig } from '../../lib/types';

const steps = [
  {
    icon: CalendarCheck,
    title: 'Pilih layanan dan slot',
    text: 'Tentukan layanan, jumlah perkiraan, lalu pilih slot antar/jemput yang masih memiliki kapasitas. Sistem mengecek kapasitas di dalam transaksi database sehingga dua pelanggan tidak dapat mengambil kursi terakhir secara bersamaan.',
  },
  {
    icon: MapPin,
    title: 'Tentukan antar atau jemput',
    text: 'Pilih drop-off jika Anda akan datang ke outlet, atau pickup jika ingin dijemput. Untuk pickup, alamat dan nomor kontak wajib diisi dan akan tersalin ke tugas kurir.',
  },
  {
    icon: Truck,
    title: 'Konfirmasi dan penjemputan',
    text: 'Admin meninjau reservasi. Setelah dikonfirmasi, cucian diterima, ditimbang, dan pesanan dibuat dengan snapshot harga agar harga tidak berubah di tengah proses.',
  },
  {
    icon: Droplets,
    title: 'Produksi dan pelacakan',
    text: 'Staf memperbarui status dari diterima, dicuci, dikeringkan, disetrika, dikemas, hingga siap. Setiap perubahan tercatat pada riwayat status pesanan.',
  },
  {
    icon: PackageCheck,
    title: 'Pembayaran dan serah terima',
    text: 'Pembayaran tunai dicatat langsung, sedangkan transfer bank menunggu verifikasi admin. Serah terima oleh kurir mencatat nama penerima sebagai bukti.',
  },
];

const faq = [
  {
    q: 'Bagaimana cara membatalkan reservasi?',
    a: 'Reservasi dapat dibatalkan dari halaman Reservasi saya selama masih memenuhi batas waktu pembatalan yang berlaku. Setelah batas waktu, hubungi admin untuk penanganan khusus.',
  },
  {
    q: 'Apakah harga bisa berubah setelah pesanan dibuat?',
    a: 'Tidak. Saat pesanan dibuat, harga layanan disalin sebagai snapshot. Perubahan harga katalog setelahnya tidak memengaruhi pesanan yang sudah berjalan.',
  },
  {
    q: 'Bagaimana perhitungan berat?',
    a: 'Berat aktual ditimbang saat cucian diterima. Tagihan menggunakan berat yang dibulatkan sesuai kebijakan, dengan minimum berat untuk layanan kiloan.',
  },
  {
    q: 'Metode pembayaran apa yang tersedia?',
    a: 'Tunai dan transfer bank. Transfer bank dicatat sebagai pending hingga admin memverifikasi bukti transfer. Refund dicatat sebagai transaksi tersendiri, bukan menghapus riwayat.',
  },
  {
    q: 'Kapan saya bisa memberi ulasan?',
    a: 'Ulasan hanya dapat dibuat untuk pesanan milik Anda yang sudah berstatus selesai, dan satu pesanan hanya dapat diulas satu kali.',
  },
];

export function HowItWorksPage() {
  const config = useApi<AppConfig>('/config');

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Panduan</p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-ink-950 sm:text-5xl">Cara kerja LRCMIS</h1>
        <p className="mt-4 text-base leading-relaxed text-ink-600">
          Satu alur dari reservasi sampai cucian kembali ke tangan Anda. Setiap peran memiliki akses dan tanggung
          jawab yang jelas.
        </p>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-4">
          {steps.map((step, index) => (
            <Card key={step.title} className="flex gap-4 p-5 sm:p-6">
              <div className="flex flex-col items-center">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-900 text-white">
                  <step.icon className="h-5 w-5" />
                </div>
                {index < steps.length - 1 && <div className="mt-2 hidden w-px flex-1 bg-ink-100 sm:block" />}
              </div>
              <div className="pb-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink-400">Langkah {index + 1}</p>
                <h2 className="mt-1 text-base font-bold text-ink-950">{step.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{step.text}</p>
              </div>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          <Card className="bg-brand-950 p-6 text-white">
            <ShieldCheck className="h-7 w-7 text-brand-300" />
            <h2 className="mt-3 font-display text-xl font-semibold">Aturan yang dijaga sistem</h2>
            <ul className="mt-4 space-y-3 text-sm text-brand-100/80">
              {[
                'Kapasitas slot dicek dan dikunci secara transaksional.',
                'Harga disalin saat pesanan dibuat, tidak berubah di tengah jalan.',
                'Pembayaran ganda dicegah dengan idempotency key.',
                'Status hanya dapat berpindah melalui transisi yang sah.',
                'Akses data pelanggan dibatasi berdasarkan kepemilikan dan peran.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-6">
            <h2 className="text-base font-bold text-ink-950">Ringkasan kebijakan</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-500">Minimum berat</dt>
                <dd className="font-semibold text-ink-900">{config.data?.minWeightKg ?? 3} kg</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-500">Pembulatan berat</dt>
                <dd className="font-semibold text-ink-900">{config.data?.weightRoundingKg ?? 0.5} kg</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-500">Biaya antar</dt>
                <dd className="font-semibold text-ink-900">{formatCurrency(config.data?.defaultDeliveryFee ?? 5000)}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-500">Batas pembatalan</dt>
                <dd className="font-semibold text-ink-900">{config.data?.reservationCancelCutoffHours ?? 2} jam</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-500">Zona waktu</dt>
                <dd className="font-semibold text-ink-900">{config.data?.businessTimezone ?? 'Asia/Jakarta'}</dd>
              </div>
            </dl>
          </Card>
          <div className="flex items-center gap-2 rounded-2xl bg-sand-100 px-4 py-3 text-xs text-sand-800">
            <Clock className="h-4 w-4 shrink-0" />
            Estimasi pengerjaan tiap layanan ditampilkan pada katalog.
          </div>
        </div>
      </div>

      <div className="mt-14">
        <h2 className="font-display text-3xl font-semibold text-ink-950">Pertanyaan yang sering diajukan</h2>
        <div className="mt-6 divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white">
          {faq.map((item) => (
            <details key={item.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink-900">
                {item.q}
                <span className="text-lg text-ink-400 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-500">{item.a}</p>
            </details>
          ))}
        </div>
      </div>

      <div className="mt-12 flex flex-col items-start justify-between gap-4 rounded-3xl bg-brand-950 p-7 text-white sm:flex-row sm:items-center">
        <div>
          <p className="font-display text-2xl font-semibold">Mulai dari reservasi pertama.</p>
          <p className="mt-1 text-sm text-brand-100/70">Butuh akun? Pendaftaran gratis dan hanya butuh satu menit.</p>
        </div>
        <Link to="/register">
          <Button variant="light" icon={<ArrowRight className="h-4 w-4" />}>
            Daftar sekarang
          </Button>
        </Link>
      </div>
    </div>
  );
}
