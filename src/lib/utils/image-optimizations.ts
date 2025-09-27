import { useState, useEffect } from 'react';

interface ImageLoaderOptions {
  quality?: number;
  width?: number;
  height?: number;
}

export function getOptimizedImageUrl(url: string, options: ImageLoaderOptions = {}) {
  const { quality = 75, width, height } = options;
  
  // Handle different image sources
  if (url.startsWith('https://firebasestorage.googleapis.com')) {
    // Add Firebase Storage transformations
    const transformedUrl = new URL(url);
    if (width) transformedUrl.searchParams.append('w', width.toString());
    if (height) transformedUrl.searchParams.append('h', height.toString());
    if (quality) transformedUrl.searchParams.append('q', quality.toString());
    return transformedUrl.toString();
  }
  
  // Return original URL for unsupported sources
  return url;
}

export function useProgressiveImage(src: string) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSrc, setCurrentSrc] = useState<string>('');

  useEffect(() => {
    const image = new Image();
    
    // Reset states when src changes
    setIsLoading(true);
    setError(null);

    const handleLoad = () => {
      setCurrentSrc(src);
      setIsLoading(false);
    };

    const handleError = () => {
      setError('Failed to load image');
      setIsLoading(false);
    };

    image.addEventListener('load', handleLoad);
    image.addEventListener('error', handleError);
    image.src = src;

    return () => {
      image.removeEventListener('load', handleLoad);
      image.removeEventListener('error', handleError);
    };
  }, [src]);

  return { isLoading, error, currentSrc };
}

// Preload common images
export function preloadCommonImages() {
  const commonImages = [
    '/backgrounds/default-bg.png',
    // Add other commonly used images
  ];

  commonImages.forEach(src => {
    const img = new Image();
    img.src = src;
  });
}