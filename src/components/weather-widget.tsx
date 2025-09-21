
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Sun, Cloud, CloudRain, Wind, Zap, Snowflake, Loader2, MapPin, CloudFog, CloudSun } from 'lucide-react';
import { getWeather, GetWeatherOutput } from '@/ai/flows/weather-flow';
import { useToast } from '@/hooks/use-toast';
import { useAppearance } from './providers/appearance-provider';
import { useRouter } from 'next/navigation';

const weatherIcons: Record<GetWeatherOutput['condition'], React.ReactNode> = {
    Sunny: <Sun className="w-5 h-5 text-yellow-400" />,
    Clear: <Sun className="w-5 h-5 text-yellow-400" />,
    Cloudy: <Cloud className="w-5 h-5 text-gray-400" />,
    Rainy: <CloudRain className="w-5 h-5 text-blue-400" />,
    Windy: <Wind className="w-5 h-5 text-gray-300" />,
    Stormy: <Zap className="w-5 h-5 text-yellow-500" />,
    Snowy: <Snowflake className="w-5 h-5 text-white" />,
    Mist: <CloudFog className="w-5 h-5 text-gray-400" />,
    Haze: <CloudSun className="w-5 h-5 text-gray-400" />,
    Fog: <CloudFog className="w-5 h-5 text-gray-400" />,
};

async function getCityFromCoords(latitude: number, longitude: number): Promise<string | null> {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        if (!response.ok) throw new Error("Failed to fetch city from coordinates");
        const data = await response.json();
        return data.address.city || data.address.town || data.address.village || null;
    } catch (error) {
        console.error('Error fetching city from coordinates:', error);
        return null;
    }
}


export function WeatherWidget() {
    const [weather, setWeather] = useState<GetWeatherOutput | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const router = useRouter();
    const { weatherLocation, setWeatherLocation, weatherUnit } = useAppearance();
    
    const fetchWeather = useCallback(async (loc: string, unit: 'Celsius' | 'Fahrenheit') => {
        if (!loc) {
            setIsLoading(false);
            setWeather(null);
            return;
        };
        setIsLoading(true);
        try {
            const result = await getWeather({ location: loc, unit });
            setWeather(result);
        } catch (error) {
            console.error("Error fetching weather:", error);
            setWeather(null);
            toast({
                title: 'Could not fetch weather',
                description: 'The location might not be recognized. Please try a different city in settings.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    useEffect(() => {
        if (weatherLocation) {
            fetchWeather(weatherLocation, weatherUnit);
        } else {
            // Only try to geolocate if location is not set
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const city = await getCityFromCoords(position.coords.latitude, position.coords.longitude);
                    if (city) {
                        setWeatherLocation(city); // This will trigger the other effect
                    } else {
                        setIsLoading(false);
                    }
                },
                (error) => {
                    console.warn("Geolocation error:", error);
                    setIsLoading(false); 
                },
                { timeout: 5000 }
            );
        }
    }, [weatherLocation, weatherUnit, fetchWeather, setWeatherLocation]);


    if (isLoading) {
        return (
            <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground" disabled>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">Loading Weather...</span>
            </Button>
        );
    }
    
    if (!weather || !weatherLocation) {
        return (
             <Button variant="ghost" size="sm" onClick={() => router.push('/settings/weather')} className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="hidden sm:inline">Set Weather Location</span>
            </Button>
        );
    }

    return (
        <Button variant="ghost" size="sm" onClick={() => router.push('/settings/weather')} className="flex items-center gap-2">
            {weatherIcons[weather.condition] || <Cloud className="w-5 h-5 text-gray-400" />}
            <span className="font-medium">{Math.round(weather.temperature)}°{weather.unit === 'Celsius' ? 'C' : 'F'}</span>
            <span className="text-muted-foreground hidden sm:inline">{weatherLocation}</span>
        </Button>
    );
}
