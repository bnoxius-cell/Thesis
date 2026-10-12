// Public holidays come from Nager.Date (free, no API key). Kept in its own module so
// tests have a local seam to mock instead of hitting the network.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();
const failures = new Map();
const inFlight = new Map();

const load = async (year, country) => {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`, {
        signal: AbortSignal.timeout(8000),
    });
    // Nager answers 204 with an empty body for countries it has no data for.
    if (res.status === 204) return [];
    if (!res.ok) throw new Error(`Holiday service responded with ${res.status}`);

    const raw = await res.json();
    return raw.map((h) => ({
        date: h.date,
        name: h.localName || h.name,
        englishName: h.name,
    }));
};

export const fetchPublicHolidays = async (year, country) => {
    const key = `${country}-${year}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.holidays;

    // When the service is down, fail straight away for a while instead of making every
    // dashboard load wait for the timeout again.
    const failure = failures.get(key);
    if (failure && Date.now() - failure.at < FAILURE_TTL_MS) throw failure.error;

    // Parallel callers for the same year share one request.
    if (inFlight.has(key)) return inFlight.get(key);

    const request = load(year, country)
        .then((holidays) => {
            cache.set(key, { at: Date.now(), holidays });
            failures.delete(key);
            return holidays;
        })
        .catch((error) => {
            failures.set(key, { at: Date.now(), error });
            throw error;
        })
        .finally(() => inFlight.delete(key));
    inFlight.set(key, request);
    return request;
};

// Tests call this so one test's cached answer or failure doesn't leak into the next.
export const resetHolidayCache = () => {
    cache.clear();
    failures.clear();
    inFlight.clear();
};
