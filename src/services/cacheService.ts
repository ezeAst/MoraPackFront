// src/services/cacheService.ts

/**
 * Servicio de caché simple para compartir datos entre componentes
 * Evita llamadas duplicadas al backend cuando se navega entre pestañas
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL = 30000; // ✅ 30 segundos por defecto (más tiempo)

  /**
   * Obtiene datos del caché si están frescos
   */
  get<T>(key: string, ttl: number = this.defaultTTL): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const age = now - entry.timestamp;

    // Si los datos son muy viejos, eliminar del caché
    if (age > ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Guarda datos en el caché
   */
  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Invalida una entrada específica del caché
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Limpia todo el caché
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Obtiene o carga datos con caché automático
   * ✅ MEJORADO: Retorna datos del caché inmediatamente y recarga en background si están por expirar
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = this.defaultTTL,
    backgroundRefreshThreshold: number = 0.7 // Recargar en background si el caché tiene >70% de su TTL
  ): Promise<T> {
    const entry = this.cache.get(key);
    const now = Date.now();
    
    if (entry) {
      const age = now - entry.timestamp;
      const agePercentage = age / ttl;
      
      // Si los datos están frescos, retornarlos inmediatamente
      if (age < ttl) {
        console.log(`✅ Cache HIT: ${key} (edad: ${Math.round(age/1000)}s / ${ttl/1000}s)`);
        
        // ✅ NUEVO: Si el caché está por expirar (>70% del TTL), recargar en background
        if (agePercentage > backgroundRefreshThreshold) {
          console.log(`🔄 Background refresh: ${key}`);
          fetcher().then(data => {
            this.set(key, data);
          }).catch(err => {
            console.error(`Error en background refresh de ${key}:`, err);
          });
        }
        
        return entry.data as T;
      }
    }

    // Si no está en caché o expiró, cargar y guardar
    console.log(`❌ Cache MISS: ${key} - Cargando...`);
    const data = await fetcher();
    this.set(key, data);
    return data;
  }

  /**
   * ✅ NUEVO: Obtiene datos del caché sin esperar, útil para mostrar datos viejos mientras se carga
   */
  getStale<T>(key: string): T | null {
    const entry = this.cache.get(key);
    return entry ? (entry.data as T) : null;
  }
}

// Instancia singleton
export const cacheService = new CacheService();