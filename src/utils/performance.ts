// Utility functions for performance optimization

// Debounce function with proper typing
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle function with proper typing
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Check if device has reduced motion preference
export const hasReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Check if device is low-end
export const isLowEndDevice = () => {
  if (typeof window === 'undefined') return false;
  
  // Check for hardware concurrency (CPU cores)
  const lowCPU = navigator.hardwareConcurrency <= 4;
  
  // Check for device memory (if available)
  const lowMemory = ('deviceMemory' in navigator) && 
    // @ts-ignore: deviceMemory exists but TypeScript doesn't know about it
    navigator.deviceMemory <= 4;
  
  // Define NetworkInformation interface
  interface NetworkInformation {
    saveData: boolean;
    effectiveType: '2g' | '3g' | '4g' | '5g' | 'slow-2g';
  }

  // Extend Navigator interface
  interface Navigator {
    connection?: NetworkInformation;
    deviceMemory?: number;
  }

  // Check for connection speed
  const slowConnection = 'connection' in navigator &&
    navigator.connection &&
    (navigator.connection.saveData ||
     ['slow-2g', '2g', '3g'].includes(navigator.connection.effectiveType));
  
  return lowCPU || lowMemory || slowConnection;
};

// Performance config based on device capabilities
export const getPerformanceConfig = () => {
  const config = {
    enableAnimations: !hasReducedMotion(),
    prefetchLimit: 2,
    imageQuality: 'high',
    cacheTime: 1000 * 60 * 30, // 30 minutes
    debounceTime: 150,
    throttleTime: 100,
  };

  if (isLowEndDevice()) {
    config.enableAnimations = false;
    config.prefetchLimit = 1;
    config.imageQuality = 'low';
    config.cacheTime = 1000 * 60 * 15; // 15 minutes
    config.debounceTime = 300;
    config.throttleTime = 200;
  }

  return config;
};