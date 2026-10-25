import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Droplets, Info, Search, Sparkles } from 'lucide-react';
import { Button, Card, EmptyState, ErrorState, Input, LoadingState } from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { formatCurrency, unitLabel } from '../../lib/format';
import type { AppConfig, Service } from '../../lib/types';

export function ServicesPage() {
  const services = useApi<Service[]>('/services');
  const config = useApi<AppConfig>('/config');
  const [query, setQuery] = useState('');
  const [unit, setUnit] = useState<'all' | Service['pricingUnit']>('all');

  const filtered = useMemo(() => {
    return (services.data ?? []).filter((service) => {
      const matchesQuery = `${service.name} ${service.description ?? ''}`.toLowerCase().includes(query.toLowerCase());
      const matchesUnit = unit === 'all' || service.pricingUnit === unit;
      return matchesQuery && matchesUnit;
    });
  }, [services.data, query, unit]);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-ink-100 bg-gradient-to-b from-brand-50 to-white">
        <div className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-accent-200/30 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Katalog layanan
            </span>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink-950 sm:text-4xl lg:text-5xl">Layanan & harga</h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-600">
              Semua harga dalam Rupiah. Untuk layanan berbasis berat, tagihan dihitung dari berat aktual saat cucian
              diterima dengan pembulatan {config.data?.weightRoundingKg ?? 0.5} kg.
            </p>
          </div>

          {config.data && (
            <div className="mt-7 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-ink-700 shadow-sm ring-1 ring-ink-100">
                <Info className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" /> Minimum {config.data.minWeightKg} kg untuk layanan kiloan
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-ink-700 shadow-sm ring-1 ring-ink-100">
                Biaya antar {formatCurrency(config.data.defaultDeliveryFee)}
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-ink-700 shadow-sm ring-1 ring-ink-100">
                Pembatalan hingga {config.data.reservationCancelCutoffHours} jam sebelum jadwal
              </span>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-card lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              className="pl-10"
              placeholder="Cari layanan..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Cari layanan"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-sand-100 p-1">
            {(
              [
                { value: 'all', label: 'Semua' },
                { value: 'kg', label: 'Per kg' },
                { value: 'piece', label: 'Per pcs' },
                { value: 'pair', label: 'Per pasang' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setUnit(option.value)}
                aria-pressed={unit === option.value}
                className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                  unit === option.value ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-800'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          {services.loading ? (
            <LoadingState label="Memuat layanan..." />
          ) : services.error ? (
            <ErrorState message={services.error} onRetry={services.refetch} />
          ) : filtered.length === 0 ? (
            <EmptyState title="Layanan tidak ditemukan" description="Coba kata kunci atau satuan lain." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((service) => (
                <Card key={service.id} className="group flex flex-col p-6 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                      <Droplets className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <span className="rounded-full bg-sand-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-500">
                      per {unitLabel[service.pricingUnit] ?? service.pricingUnit}
                    </span>
                  </div>
                  <h2 className="mt-4 text-lg font-bold text-ink-950">{service.name}</h2>
                  <p className="mt-1 flex-1 text-sm leading-relaxed text-ink-500">
                    {service.description || 'Layanan laundry dengan proses profesional.'}
                  </p>
                  <div className="mt-5 flex items-end justify-between border-t border-ink-100 pt-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Harga</p>
                      <p className="text-xl font-extrabold text-ink-950">
                        {formatCurrency(service.price)}
                        <span className="ml-1 text-xs font-medium text-ink-400">/{unitLabel[service.pricingUnit]}</span>
                      </p>
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
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 rounded-[1.75rem] border border-brand-100 bg-brand-50/50 p-6 sm:flex-row sm:items-center sm:p-8">
          <div>
            <p className="text-xl font-extrabold text-ink-950">Siap memesan layanan?</p>
            <p className="mt-1 text-sm text-ink-500">Masuk atau daftar untuk memilih slot dan membuat reservasi.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/login">
              <Button variant="outline">Masuk</Button>
            </Link>
            <Link to="/register">
              <Button icon={<ArrowRight className="h-4 w-4" />}>Daftar</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
