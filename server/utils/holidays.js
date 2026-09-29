// Public holidays come from Nager.Date (free, no API key). Kept in its own module so
// tests have a local seam to mock instead of hitting the network.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();

export const fetchPublicHolidays = async (year, country) => {
    const key = `${country}-${year}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.holidays;

    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`, {
        signal: AbortSignal.timeout(8000),
    });
    // Nager answers 204 with an empty body for countries it has no data for.
    if (res.status === 204) return [];
    if (!res.ok) throw new Error(`Holiday service responded with ${res.status}`);

    const raw = await res.json();
    const holidays = raw.map((h) => ({
        date: h.date,
        name: h.localName || h.name,
        englishName: h.name,
    }));
    cache.set(key, { at: Date.now(), holidays });
    return holidays;
};
