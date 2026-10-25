import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  MapPin,
  Package,
  Plus,
  Store,
  Truck,
} from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  ProgressSteps,
  Textarea,
} from '../../components/ui';
import { Note } from '../../components/common';
import { useApi } from '../../lib/useApi';
import { useAction } from '../../lib/useApi';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { formatCurrency, formatDate, unitLabel, weekday } from '../../lib/format';
import type { Address, AppConfig, Reservation, Service, TimeSlot } from '../../lib/types';

const steps = ['Layanan', 'Metode', 'Jadwal', 'Konfirmasi'];

export function NewReservationPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const services = useApi<Service[]>('/services');
  const addresses = useApi<Address[]>('/users/me/addresses');
  const slots = useApi<TimeSlot[]>('/time-slots');
  const config = useApi<AppConfig>('/config');
  const action = useAction();

  const [step, setStep] = useState(0);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [pickupType, setPickupType] = useState<'drop_off' | 'pickup'>('drop_off');
  const [addressId, setAddressId] = useState<string>('');
  const [slotId, setSlotId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [addressModal, setAddressModal] = useState(false);
  const [addressForm, setAddressForm] = useState({ label: 'Rumah', recipientName: '', phone: '', addressText: '', isDefault: false });
  const [savingAddress, setSavingAddress] = useState(false);

  const selectedServices = useMemo(
    () => (services.data ?? []).filter((service) => (quantities[service.id] ?? 0) > 0),
    [services.data, quantities],
  );
  const groupedSlots = useMemo(() => {
    const map = new Map<string, TimeSlot[]>();
    for (const slot of slots.data ?? []) {
      const list = map.get(slot.slotDate) ?? [];
      list.push(slot);
      map.set(slot.slotDate, list);
    }
    return [...map.entries()];
  }, [slots.data]);

  const estimatedSubtotal = selectedServices.reduce((sum, service) => {
    if (service.pricingUnit === 'kg') return sum;
    return sum + service.price * (quantities[service.id] ?? 0);
  }, 0);
  const estimatedDelivery = pickupType === 'pickup' ? (config.data?.defaultDeliveryFee ?? 5000) : 0;
  const selectedSlot = (slots.data ?? []).find((slot) => slot.id === slotId);
  const selectedAddress = (addresses.data ?? []).find((address) => address.id === addressId);

  const validateStep = (target: number): boolean => {
    setError(null);
    if (target > 0 && selectedServices.length === 0) {
      setError('Pilih minimal satu layanan sebelum melanjutkan.');
      setStep(0);
      return false;
    }
    if (target > 1 && pickupType === 'pickup' && !addressId) {
      setError('Pilih alamat pickup terlebih dahulu.');
      setStep(1);
      return false;
    }
    if (target > 2 && !slotId) {
      setError('Pilih slot waktu terlebih dahulu.');
      setStep(2);
      return false;
    }
    return true;
  };

  const go = (target: number) => {
    if (target > step && !validateStep(target)) return;
    setStep(target);
  };

  const submit = async () => {
    if (!validateStep(3)) return;
    const result = await action.run(() =>
      api.post<Reservation>('/reservations', {
        timeSlotId: slotId,
        pickupType,
        ...(pickupType === 'pickup' ? { addressId } : {}),
        notes: notes.trim() || undefined,
        items: selectedServices.map((service) => ({
          serviceId: service.id,
          quantity: quantities[service.id] || 1,
        })),
      }),
    );
    if (result) {
      toast(`Reservasi ${result.reservationCode} berhasil dibuat. Menunggu konfirmasi admin.`);
      navigate('/reservasi');
    } else if (action.error) {
      setError(action.error);
    }
  };

  const saveAddress = async () => {
    setSavingAddress(true);
    try {
      const created = await api.post<Address>('/users/me/addresses', {
        ...addressForm,
        phone: addressForm.phone || undefined,
        recipientName: addressForm.recipientName || undefined,
      });
      addresses.refetch();
      setAddressId(created.id);
      setAddressModal(false);
      setAddressForm({ label: 'Rumah', recipientName: '', phone: '', addressText: '', isDefault: false });
      toast('Alamat berhasil ditambahkan');
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'Gagal menyimpan alamat', 'error');
    } finally {
      setSavingAddress(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Reservasi"
        title="Buat reservasi baru"
        description="Pilih layanan, metode penyerahan, dan slot waktu. Kapasitas slot dicek ulang oleh server saat reservasi dibuat."
        actions={
          <Link to="/reservasi">
            <Button variant="outline" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
              Kembali
            </Button>
          </Link>
        }
      />

      <div className="mb-6 rounded-2xl border border-ink-100 bg-white p-4 shadow-card sm:p-5">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-400">Langkah reservasi</p>
        </div>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <ProgressSteps steps={steps} current={step} />
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.5fr_0.5fr]">
        <div className="space-y-5">
          {step === 0 && (
            <Card className="p-5 sm:p-6">
              <h2 className="flex items-center gap-2.5 text-lg font-extrabold text-ink-950"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">1</span>Pilih layanan</h2>
              <p className="mt-1 text-sm text-ink-500">
                Untuk layanan kiloan, jumlah di bawah adalah perkiraan. Tagihan final mengikuti berat aktual saat
                cucian diterima (minimum {config.data?.minWeightKg ?? 3} kg).
              </p>
              {services.loading ? (
                <div className="mt-4"><LoadingState label="Memuat layanan..." /></div>
              ) : services.error ? (
                <div className="mt-4"><ErrorState message={services.error} onRetry={services.refetch} /></div>
              ) : (services.data ?? []).length === 0 ? (
                <div className="mt-4"><EmptyState title="Belum ada layanan aktif" description="Silakan hubungi admin." /></div>
              ) : (
                <div className="mt-4 space-y-3">
                  {(services.data ?? []).map((service) => {
                    const quantity = quantities[service.id] ?? 0;
                    return (
                      <div
                        key={service.id}
                        className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition ${
                          quantity > 0 ? 'border-brand-300 bg-brand-50/40' : 'border-ink-100'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-ink-950">{service.name}</p>
                          <p className="mt-0.5 line-clamp-1 text-xs text-ink-400">{service.description || 'Layanan laundry'}</p>
                          <p className="mt-1 text-xs font-semibold text-brand-700">
                            {formatCurrency(service.price)} / {unitLabel[service.pricingUnit]}
                            {service.estimatedHours ? ` · ±${service.estimatedHours} jam` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setQuantities((current) => ({
                                ...current,
                                [service.id]: Math.max(0, (current[service.id] ?? 0) - 1),
                              }))
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-lg font-bold text-ink-600 hover:bg-ink-50"
                            aria-label={`Kurangi ${service.name}`}
                          >
                            −
                          </button>
                          <span className="w-10 text-center text-sm font-bold text-ink-900">{quantity}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setQuantities((current) => ({
                                ...current,
                                [service.id]: Math.min(50, (current[service.id] ?? 0) + 1),
                              }))
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-lg font-bold text-ink-600 hover:bg-ink-50"
                            aria-label={`Tambah ${service.name}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {step === 1 && (
            <Card className="p-5 sm:p-6">
              <h2 className="flex items-center gap-2.5 text-lg font-extrabold text-ink-950"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">2</span>Metode penyerahan</h2>
              <p className="mt-1 text-sm text-ink-500">Antar sendiri ke outlet atau minta kurir menjemput.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPickupType('drop_off')}
                  className={`rounded-2xl border p-4 text-left transition ${
                    pickupType === 'drop_off' ? 'border-brand-400 bg-brand-50/60 ring-2 ring-brand-100' : 'border-ink-100 hover:border-ink-200'
                  }`}
                >
                  <Store className="h-6 w-6 text-brand-700" />
                  <p className="mt-3 text-sm font-bold text-ink-950">Drop-off</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-500">Antar cucian ke outlet sesuai slot. Tanpa biaya antar.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setPickupType('pickup')}
                  className={`rounded-2xl border p-4 text-left transition ${
                    pickupType === 'pickup' ? 'border-brand-400 bg-brand-50/60 ring-2 ring-brand-100' : 'border-ink-100 hover:border-ink-200'
                  }`}
                >
                  <Truck className="h-6 w-6 text-brand-700" />
                  <p className="mt-3 text-sm font-bold text-ink-950">Pickup & delivery</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-500">
                    Kurir menjemput dan mengantar. Biaya antar {formatCurrency(config.data?.defaultDeliveryFee ?? 5000)}.
                  </p>
                </button>
              </div>

              {pickupType === 'pickup' && (
                <div className="mt-5 border-t border-ink-100 pt-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-ink-900">Alamat penjemputan</h3>
                    <Button size="sm" variant="outline" onClick={() => setAddressModal(true)} icon={<Plus className="h-4 w-4" />}>
                      Alamat baru
                    </Button>
                  </div>
                  {addresses.loading ? (
                    <p className="mt-3 text-sm text-ink-400">Memuat alamat...</p>
                  ) : (addresses.data ?? []).length === 0 ? (
                    <div className="mt-3"><Note tone="warning">Belum ada alamat tersimpan. Tambahkan alamat terlebih dahulu.</Note></div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {(addresses.data ?? []).map((address) => (
                        <label
                          key={address.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${
                            addressId === address.id ? 'border-brand-400 bg-brand-50/50' : 'border-ink-100 hover:border-ink-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name="address"
                            className="mt-1 accent-brand-700"
                            checked={addressId === address.id}
                            onChange={() => setAddressId(address.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-ink-900">
                              {address.label || 'Alamat'} {address.isDefault && <span className="ml-1 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-800">Utama</span>}
                            </p>
                            <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{address.addressText}</p>
                            {(address.recipientName || address.phone) && (
                              <p className="mt-1 text-xs text-ink-400">{[address.recipientName, address.phone].filter(Boolean).join(' · ')}</p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {step === 2 && (
            <Card className="p-5 sm:p-6">
              <h2 className="flex items-center gap-2.5 text-lg font-extrabold text-ink-950"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">3</span>Pilih slot waktu</h2>
              <p className="mt-1 text-sm text-ink-500">Hanya slot dengan kapasitas tersisa yang ditampilkan.</p>
              {slots.loading ? (
                <div className="mt-4"><LoadingState label="Memuat jadwal..." /></div>
              ) : slots.error ? (
                <div className="mt-4"><ErrorState message={slots.error} onRetry={slots.refetch} /></div>
              ) : groupedSlots.length === 0 ? (
                <div className="mt-4"><EmptyState title="Belum ada slot tersedia" description="Hubungi admin atau coba lagi nanti." icon={<CalendarDays className="h-6 w-6" />} /></div>
              ) : (
                <div className="mt-4 space-y-5">
                  {groupedSlots.map(([date, list]) => (
                    <div key={date}>
                      <p className="text-xs font-bold uppercase tracking-wide text-ink-400">
                        {weekday(date)}, {formatDate(date)}
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {list.map((slot) => (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setSlotId(slot.id)}
                            className={`rounded-xl border px-3.5 py-3 text-left transition ${
                              slotId === slot.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-ink-100 hover:border-brand-200'
                            }`}
                          >
                            <p className="text-sm font-bold text-ink-900">{slot.startTime}–{slot.endTime}</p>
                            <p className="mt-0.5 text-[11px] text-ink-400">
                              {slot.remaining} dari {slot.capacity} tersisa
                            </p>
                            {slotId === slot.id && (
                              <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-brand-700">
                                <Check className="h-3 w-3" /> Dipilih
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 border-t border-ink-100 pt-5">
                <Field label="Catatan untuk tim" htmlFor="notes" hint="Opsional, misalnya instruksi khusus atau titik jemput">
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    maxLength={1000}
                    placeholder="Contoh: titipkan ke resepsionis bila saya belum di rumah."
                  />
                </Field>
              </div>
            </Card>
          )}

          {step === 3 && (
            <Card className="p-5 sm:p-6">
              <h2 className="flex items-center gap-2.5 text-lg font-extrabold text-ink-950"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">4</span>Periksa dan konfirmasi</h2>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl bg-sand-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Layanan</p>
                  <div className="mt-2 space-y-1.5">
                    {selectedServices.map((service) => (
                      <div key={service.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-ink-700">
                          {service.name} <span className="text-ink-400">× {quantities[service.id]}</span>
                        </span>
                        <span className="font-semibold text-ink-900">
                          {service.pricingUnit === 'kg'
                            ? `${formatCurrency(service.price)} / kg`
                            : formatCurrency(service.price * (quantities[service.id] ?? 0))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-ink-100 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Metode</p>
                    <p className="mt-1 text-sm font-semibold text-ink-900">{pickupType === 'pickup' ? 'Pickup & delivery' : 'Drop-off'}</p>
                    {pickupType === 'pickup' && selectedAddress && (
                      <p className="mt-1 text-xs leading-relaxed text-ink-500">{selectedAddress.addressText}</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-ink-100 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Jadwal</p>
                    <p className="mt-1 text-sm font-semibold text-ink-900">
                      {selectedSlot ? `${formatDate(selectedSlot.slotDate)}, ${selectedSlot.startTime}–${selectedSlot.endTime}` : '-'}
                    </p>
                    {selectedSlot && <p className="mt-1 text-xs text-ink-500">{selectedSlot.remaining} slot tersisa saat dimuat</p>}
                  </div>
                </div>
                {notes.trim() && (
                  <div className="rounded-xl border border-ink-100 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Catatan</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-600">{notes}</p>
                  </div>
                )}
              </div>
              <div className="mt-4"><Note>Reservasi berstatus menunggu konfirmasi admin. Anda dapat membatalkan selama belum dikonfirmasi dan masih memenuhi batas waktu.</Note></div>
            </Card>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" onClick={() => go(Math.max(0, step - 1))} disabled={step === 0} icon={<ArrowLeft className="h-4 w-4" />}>
              Sebelumnya
            </Button>
            {step < 3 ? (
              <Button onClick={() => go(step + 1)} icon={<ArrowRight className="h-4 w-4" />}>
                Lanjut
              </Button>
            ) : (
              <Button onClick={submit} loading={action.loading} icon={<CheckCircle2 className="h-4 w-4" />}>
                Buat reservasi
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-4 xl:sticky xl:top-[88px] xl:self-start">
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-400">Ringkasan</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-ink-500">Layanan dipilih</span>
                <span className="font-semibold text-ink-900">{selectedServices.length}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-ink-500">Estimasi subtotal</span>
                <span className="font-semibold text-ink-900">{formatCurrency(estimatedSubtotal)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-ink-500">Biaya antar</span>
                <span className="font-semibold text-ink-900">{formatCurrency(estimatedDelivery)}</span>
              </div>
              <div className="flex justify-between gap-3 border-t border-ink-100 pt-2">
                <span className="font-bold text-ink-900">Estimasi total</span>
                <span className="font-extrabold text-brand-800">{formatCurrency(estimatedSubtotal + estimatedDelivery)}</span>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
              Estimasi belum termasuk layanan kiloan yang dihitung setelah penimbangan. Harga final tampil pada detail
              pesanan setelah cucian diterima.
            </p>
          </Card>
          <Card className="p-5">
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
              <div>
                <p className="text-sm font-bold text-ink-900">Outlet</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-500">Jl. Untung Suropati, Kota Bandar Lampung</p>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2.5">
              <Package className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
              <div>
                <p className="text-sm font-bold text-ink-900">Pembayaran</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-500">Tunai atau transfer bank setelah total tagihan ditetapkan.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Modal open={addressModal} onClose={() => setAddressModal(false)} title="Tambah alamat" description="Alamat ini dapat dipakai untuk pickup berikutnya.">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Label" htmlFor="label">
              <Input id="label" value={addressForm.label} onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })} placeholder="Rumah / Kantor" />
            </Field>
            <Field label="Nama penerima" htmlFor="recipient">
              <Input id="recipient" value={addressForm.recipientName} onChange={(e) => setAddressForm({ ...addressForm, recipientName: e.target.value })} placeholder="Nama di lokasi" />
            </Field>
          </div>
          <Field label="Nomor telepon" htmlFor="addressPhone" hint="Format 08xx">
            <Input id="addressPhone" type="tel" value={addressForm.phone} onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })} placeholder="081234567890" />
          </Field>
          <Field label="Alamat lengkap" htmlFor="addressText" required>
            <Textarea id="addressText" value={addressForm.addressText} onChange={(e) => setAddressForm({ ...addressForm, addressText: e.target.value })} placeholder="Jalan, nomor, RT/RW, kelurahan, kecamatan, kota, kode pos" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink-600">
            <input type="checkbox" checked={addressForm.isDefault} onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })} className="accent-brand-700" />
            Jadikan alamat utama
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddressModal(false)}>Batal</Button>
            <Button onClick={saveAddress} loading={savingAddress} disabled={addressForm.addressText.trim().length < 10}>
              Simpan alamat
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
