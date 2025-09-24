// Cache for geocoding results
const geocodingCache = new Map<string, { city: string | null; timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

export async function getCityFromCoords(latitude: number, longitude: number): Promise<string | null> {
    const cacheKey = `${latitude},${longitude}`;
    const now = Date.now();
    
    // Check cache first
    const cached = geocodingCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        return cached.city;
    }
    
    // Rate limiting
    const timeUntilNextRequest = lastRequestTime + MIN_REQUEST_INTERVAL - now;
    if (timeUntilNextRequest > 0) {
        await new Promise(resolve => setTimeout(resolve, timeUntilNextRequest));
    }
    
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            {
                headers: {
                    'User-Agent': 'Vibez Chat App (Development)',
                    'Accept-Language': 'en'
                },
                cache: 'force-cache'
            }
        );
        
        if (!response.ok) throw new Error("Failed to fetch city from coordinates");
        
        const data = await response.json();
        const city = data.address.city || data.address.town || data.address.village || null;
        
        // Update cache and last request time
        geocodingCache.set(cacheKey, { city, timestamp: now });
        lastRequestTime = now;
        
        return city;
    } catch (error) {
        console.error('Error fetching city from coordinates:', error);
        return null;
    }
}