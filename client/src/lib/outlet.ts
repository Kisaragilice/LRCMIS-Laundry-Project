/**
 * Single source of truth for outlet contact and location details.
 * The coordinates are the same point used by the public Google Maps link.
 */
export const OUTLET = {
  name: 'LRCMIS Outlet',
  address: 'Jl. Untung Suropati No.67, Labuhan Ratu, Kec. Kedaton, Kota Bandar Lampung, Lampung 35142',
  shortAddress: 'Jl. Untung Suropati No.67, Kota Bandar Lampung',
  latitude: -5.3714192,
  longitude: 105.2545533,
  phone: '+62 896 3420 4779',
  phoneHref: 'tel:+6289834204779',
  email: 'tiaralaundry@lrcmis.my.id',
  hours: 'Setiap hari, 07.00–21.00 WIB',
  mapsUrl: 'https://maps.app.goo.gl/7nPENqqwSVoLRT7r7',
} as const;
