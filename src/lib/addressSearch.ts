export interface AddressSearchResult {
  display_name: string;
  street: string;
  city: string;
  postal_code: string;
  lat: number;
  lng: number;
}

interface NominatimAddress {
  road?: string;
  house_number?: string;
  city?: string;
  town?: string;
  village?: string;
  postcode?: string;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address: NominatimAddress;
}

export async function searchAddress(
  query: string,
  abortSignal?: AbortSignal
): Promise<AddressSearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: '1',
    countrycodes: 'pl',
    limit: '5',
  });

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: { 'User-Agent': 'LovableApp' },
      signal: abortSignal,
    }
  );

  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);

  const data: NominatimResult[] = await res.json();

  return data.map((item) => {
    const a = item.address;
    const street = [a.road, a.house_number].filter(Boolean).join(' ');
    const city = a.city || a.town || a.village || '';

    return {
      display_name: item.display_name,
      street,
      city,
      postal_code: a.postcode || '',
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    };
  });
}
