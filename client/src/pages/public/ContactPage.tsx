import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { Card } from '../../components/ui';

export function ContactPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Hubungi kami</p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-ink-950 sm:text-5xl">Kami siap membantu</h1>
        <p className="mt-4 text-base leading-relaxed text-ink-600">
          Punya pertanyaan tentang pesanan, jadwal, atau kerja sama? Hubungi tim operasional LRCMIS melalui kanal di
          bawah ini.
        </p>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: MapPin,
              title: 'Outlet utama',
              lines: ['Jl. Untung Suropati No.67, Kota Bandar Lampung'],
            },
            {
              icon: Phone,
              title: 'Telepon / WhatsApp',
              lines: ['+62 896 3420 4779', 'Senin–Minggu, 07.00–21.00 WIB'],
            },
            {
              icon: Mail,
              title: 'Email',
              lines: ['tiaralaundry@lrcmis.my.id', 'Balasan dalam 1×24 jam kerja'],
            },
            {
              icon: Clock,
              title: 'Jam operasional',
              lines: ['Setiap hari 07.00–21.00 WIB', 'Slot terakhir 19.00 WIB'],
            },
          ].map((item) => (
            <Card key={item.title} className="p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <item.icon className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm font-bold text-ink-900">{item.title}</p>
              {item.lines.map((line) => (
                <p key={line} className="mt-1 text-sm text-ink-500">
                  {line}
                </p>
              ))}
            </Card>
          ))}
          <Card className="p-5 sm:col-span-2">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-ink-900">Sudah punya akun?</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-500">
                  Untuk pertanyaan terkait pesanan tertentu, buat keluhan dari dashboard agar tim dapat melihat detail
                  pesanan dan riwayat tindak lanjut secara aman.
                </p>
                <a
                  href="mailto:server@kisaragilice.my.id?subject=Pertanyaan%20LRCMIS"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:text-brand-900"
                >
                  Kirim email ke tim kami →
                </a>
              </div>
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden p-0">
          <div className="bg-brand-950 px-6 py-6 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-300">Lokasi outlet</p>
            <h2 className="mt-1 font-display text-2xl font-semibold">Bandar Lampung</h2>
            <p className="mt-2 text-sm text-brand-100/70">
              Parkir tersedia. Silakan datang sesuai slot reservasi agar tidak menunggu.
            </p>
          </div>
          <div className="relative h-72 bg-[linear-gradient(135deg,#e6efec_0%,#f5f1e8_50%,#dbe7e4_100%)] p-6">
            <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(#0a5453_1px,transparent_1px),linear-gradient(90deg,#0a5453_1px,transparent_1px)] [background-size:38px_38px]" />
            <div className="relative flex h-full flex-col items-center justify-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-900 text-white shadow-soft">
                <MapPin className="h-7 w-7" />
              </div>
              <p className="mt-3 font-display text-lg font-semibold text-brand-950">LRCMIS Outlet</p>
              <p className="mt-1 max-w-xs text-sm text-ink-600">
                Jl. Untung Suropati No.67, Kota Bandar Lampung
              </p>
              <a
                href="https://maps.app.goo.gl/7nPENqqwSVoLRT7r7"
                target="_blank"
                rel="noreferrer"
                className="mt-4 rounded-xl bg-white px-4 py-2 text-xs font-bold text-brand-800 shadow-sm hover:bg-brand-50"
              >
                Buka di Google Maps
              </a>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
