import { useRef, useEffect, useState } from 'react';
import Map, { Marker, Source, Layer, MapRef } from 'react-map-gl';
import type { LayerProps } from 'react-map-gl';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

type OutgoingFlight = {
  id: string;
  flightCode: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  status: 'scheduled' | 'in_flight' | 'landed';
  packages: number;
  capacity: number;
  occupancyPercentage: number;
};

type OutgoingOrder = {
  orderId: string;
  destination: string;
  flightCode: string;
  departureTime: string;
  weight: number;
  registeredTime: string;
};

type Warehouse = {
  name: string;
  codigo: string;
  lat: number;
  lng: number;
  status: 'normal' | 'warning' | 'critical' | 'full';
  capacity?: number;
  current?: number;
  occupancyPercentage?: number;
  productsInTransit?: number;
  productsAtDestination?: number;
  outgoingFlights?: OutgoingFlight[];
  outgoingOrders?: OutgoingOrder[];
};

type Route = {
  id: string;
  coordinates: [number, number][];
  color: string;
  // 0 to 1 representing how much of the route has been completed
  progress?: number;
};

type Props = {
  warehouses: Warehouse[];
  routes?: Route[];
  children?: React.ReactNode;
  onMapLoad?: (map: mapboxgl.Map) => void;
  onWarehouseClick?: (codigoAlmacen: string) => void;
};

export default function MapboxMap({ warehouses, routes = [], children, onMapLoad, onWarehouseClick }: Props) {
  const mapRef = useRef<MapRef>(null);
  const [hoveredWarehouseCode, setHoveredWarehouseCode] = useState<string | null>(null);
  const [pinnedWarehouseCode, setPinnedWarehouseCode] = useState<string | null>(null);

  useEffect(() => {
    if (mapRef.current && onMapLoad) {
      onMapLoad(mapRef.current.getMap());
    }
  }, [onMapLoad]);

  // Cerrar tooltip pinned al hacer click fuera
  useEffect(() => {
    const handleClickOutside = () => {
      if (pinnedWarehouseCode) {
        setPinnedWarehouseCode(null);
      }
    };

    if (pinnedWarehouseCode) {
      // Usar setTimeout para evitar que el click que abrió el tooltip lo cierre inmediatamente
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [pinnedWarehouseCode]);

  // Debug: descomentar para ver el estado del hoveredWarehouseCode
  // useEffect(() => {
  //   console.log('hoveredWarehouseCode:', hoveredWarehouseCode);
  //   console.log('pinnedWarehouseCode:', pinnedWarehouseCode);
  // }, [hoveredWarehouseCode, pinnedWarehouseCode]);

  // Función para formatear la hora de los vuelos
  const formatFlightTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: 'short'
      });
    } catch {
      return isoString;
    }
  };

  // Función para obtener el estado del vuelo en español
  const getFlightStatusText = (status: string) => {
    switch (status) {
      case 'in_flight': return '✈️ En vuelo';
      case 'landed': return '✓ Aterrizó';
      case 'scheduled': return '⏰ Programado';
      default: return status;
    }
  };

 const getWarehouseColor = (status: string) => {
  switch (status) {
    case 'critical': return '#DC3545';
    case 'full': return '#DC3545';  // Mismo color que critical
    case 'warning': return '#FFC107';
    case 'normal': return '#28A745';
    default: return '#6B7280';
  }
};

  const routeLayer: LayerProps = {
    id: 'route',
    type: 'line',
    paint: {
      'line-width': 3,
      'line-color': ['get', 'color'],
      'line-dasharray': [2, 2]
    }
  };

  // Compute remaining segment of a LineString based on progress (0..1)
  const trimLineByProgress = (coords: [number, number][], progress?: number): [number, number][] => {
    if (!coords || coords.length < 2) return coords;
    const p = Math.max(0, Math.min(1, progress ?? 0));
    if (p <= 0) return coords; // no trimming
    if (p >= 1) return [coords[coords.length - 1]]; // fully completed

    // Haversine distance in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dist = (a: [number, number], b: [number, number]) => {
      const R = 6371000;
      const dLat = toRad(b[1] - a[1]);
      const dLon = toRad(b[0] - a[0]);
      const lat1 = toRad(a[1]);
      const lat2 = toRad(b[1]);
      const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(s));
    };

    // Total length
    const segLengths: number[] = [];
    let total = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      const d = dist(coords[i], coords[i + 1]);
      segLengths.push(d);
      total += d;
    }

    const target = total * p;
    let acc = 0;
    for (let i = 0; i < segLengths.length; i++) {
      const segLen = segLengths[i];
      if (acc + segLen >= target) {
        const remainingInSeg = target - acc;
        const t = segLen === 0 ? 1 : remainingInSeg / segLen; // 0..1 along segment
        const [x1, y1] = coords[i];
        const [x2, y2] = coords[i + 1];
        const xi = x1 + (x2 - x1) * t;
        const yi = y1 + (y2 - y1) * t;
        // Return trimmed line starting at interpolated point to the end
        return [[xi, yi], ...coords.slice(i + 1)];
      }
      acc += segLen;
    }
    // If not found (edge case), return last point
    return [coords[coords.length - 1]];
  };

  // Lista de ciudades que deben mostrar el icono de almacén
  const warehouseIconCities = ['Baku', 'Bruselas', 'Lima'];

  return (
        <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN || ''}
        attributionControl={false}
        initialViewState={{
            longitude: 4.3517,
            latitude: 30,
            zoom: 2,
            pitch: 0,
            bearing: 0
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        projection={{ name: 'mercator' }}  
        >
      {/* Rutas */}
      {routes.map((route) => {
        const trimmed = trimLineByProgress(route.coordinates, route.progress);
        return (
          <Source
            key={route.id}
            id={route.id}
            type="geojson"
            data={{
              type: 'Feature',
              properties: { color: route.color },
              geometry: {
                type: 'LineString',
                coordinates: trimmed
              }
            }}
          >
            <Layer {...routeLayer} id={`${route.id}-layer`} />
          </Source>
        );
      })}

      {/* Almacenes */}
      {warehouses.map((warehouse, i) => {
        // Crear un ID único para cada warehouse
        const warehouseId = warehouse.codigo || `${warehouse.name}-${i}`;
        
        return (
        <Marker
          key={warehouseId}
          longitude={warehouse.lng}
          latitude={warehouse.lat}
        >
          <div 
            className="relative group"
            onClick={(e) => {
              e.stopPropagation(); // Evitar que el click se propague al mapa
              // Toggle: si está pinned, lo despinna; si no, lo pinna
              if (pinnedWarehouseCode === warehouseId) {
                setPinnedWarehouseCode(null);
              } else {
                setPinnedWarehouseCode(warehouseId);
              }
              // Llamar al callback opcional
              if (onWarehouseClick) {
                onWarehouseClick(warehouse.codigo);
              }
            }}
            onMouseEnter={() => {
              console.log('Mouse enter:', warehouseId); // Debug
              // Solo actualizar hover si no está pinned
              if (pinnedWarehouseCode !== warehouseId) {
                setHoveredWarehouseCode(warehouseId);
              }
            }}
            onMouseLeave={() => {
              console.log('Mouse leave'); // Debug
              // Solo quitar hover si no está pinned
              if (pinnedWarehouseCode !== warehouseId) {
                setHoveredWarehouseCode(null);
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            {warehouseIconCities.includes(warehouse.name) ? (
              // Icono de almacén para las ciudades especificadas
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                className="cursor-pointer transition-transform hover:scale-125"
                style={{ fill: getWarehouseColor(warehouse.status) }}
              >
                <path d="M12 3L2 9v12h20V9L12 3zm0 2.21l6 3.6v1.2h-12v-1.2l6-3.6zM4 19v-8h16v8H4zm2-6h12v4H6v-4z"/>
              </svg>
            ) : (
              // Punto circular para el resto de las ciudades
              <div
                className="w-4 h-4 rounded-full border-2 border-white shadow-lg cursor-pointer transition-transform hover:scale-125"
                style={{ backgroundColor: getWarehouseColor(warehouse.status) }}
              />
            )}

            {/* Tooltip con información del warehouse y vuelos salientes */}
            {(hoveredWarehouseCode === warehouseId || pinnedWarehouseCode === warehouseId) && (
              <div 
                className="absolute left-full ml-3 top-0 z-50 bg-white rounded-lg shadow-xl border border-gray-300 w-80"
                style={{ pointerEvents: 'auto' }}
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={() => {
                  if (pinnedWarehouseCode !== warehouseId) {
                    setHoveredWarehouseCode(warehouseId);
                  }
                }}
                onMouseLeave={() => {
                  if (pinnedWarehouseCode !== warehouseId) {
                    setHoveredWarehouseCode(null);
                  }
                }}
              >
                {/* Header del warehouse - MÁS COMPACTO */}
                <div className="bg-white border-b border-gray-200 px-3 py-2 rounded-t-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-base text-gray-900">{warehouse.name}</h3>
                      <p className="text-xs text-gray-600">{warehouse.codigo}</p>
                    </div>
                    {pinnedWarehouseCode === warehouseId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPinnedWarehouseCode(null);
                        }}
                        className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors"
                        title="Cerrar"
                      >
                        <svg 
                          width="16" 
                          height="16" 
                          viewBox="0 0 20 20" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2"
                          className="text-gray-500"
                        >
                          <path d="M5 5L15 15M5 15L15 5" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {pinnedWarehouseCode === warehouseId && (
                    <p className="text-[10px] text-blue-600 mt-0.5">📌 Pinned</p>
                  )}
                </div>

                <div className="p-3 space-y-2">
                  {/* Información de capacidad - ULTRA COMPACTA */}
                  {typeof warehouse.capacity === 'number' && typeof warehouse.current === 'number' && (
                    <div className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1.5">
                      <span className="text-gray-600">Capacidad</span>
                      <span className="font-semibold text-gray-900">{warehouse.current}/{warehouse.capacity}</span>
                      {typeof warehouse.occupancyPercentage === 'number' && (
                        <span className={`font-bold ${
                          warehouse.occupancyPercentage >= 90 ? 'text-red-600' :
                          warehouse.occupancyPercentage >= 70 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {warehouse.occupancyPercentage.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  )}

                  {/* Lista de vuelos salientes - ULTRA COMPACTA */}
                  {warehouse.outgoingFlights && warehouse.outgoingFlights.length > 0 ? (
                    <div className="border-t border-gray-200 pt-2">
                      {(() => {
                        const scheduledFlights = warehouse.outgoingFlights
                          .filter(flight => flight.status === 'scheduled')
                          .slice(0, 3);
                        
                        if (scheduledFlights.length === 0) {
                          return (
                            <p className="text-xs text-gray-500 text-center italic py-1">
                              No hay vuelos programados
                            </p>
                          );
                        }
                        
                        return (
                          <>
                            <h4 className="font-semibold text-xs mb-1.5 text-gray-700">
                              ✈️ Próximos vuelos ({scheduledFlights.length})
                            </h4>
                            <div className="space-y-1">
                              {scheduledFlights.map((flight, idx) => (
                                <div 
                                  key={idx} 
                                  className="text-[10px] bg-blue-50 rounded px-2 py-1 border border-blue-100"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-gray-700">{flight.flightCode}</span>
                                    <span className="text-gray-600">{formatFlightTime(flight.departureTime)}</span>
                                  </div>
                                  <div className="flex items-center justify-between mt-0.5">
                                    <span className="text-gray-600">→ {flight.destination}</span>
                                    <span className="text-gray-600">{flight.packages}kg</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="border-t border-gray-200 pt-2">
                      <p className="text-xs text-gray-500 text-center italic py-1">
                        No hay vuelos programados
                      </p>
                    </div>
                  )}

                  {/* Lista de pedidos próximos - ULTRA COMPACTA */}
                  <div className="border-t border-gray-200 pt-2">
                    {(() => {
                      if (!warehouse.outgoingOrders || warehouse.outgoingOrders.length === 0) {
                        return (
                          <p className="text-xs text-gray-500 text-center italic py-1">
                            No hay pedidos programados
                          </p>
                        );
                      }
                      
                      const nextOrders = warehouse.outgoingOrders.slice(0, 3);
                      
                      return (
                        <>
                          <h4 className="font-semibold text-xs mb-1.5 text-gray-700">
                            📦 Próximos pedidos ({nextOrders.length})
                          </h4>
                          <div className="space-y-1">
                            {nextOrders.map((order, idx) => (
                              <div 
                                key={idx} 
                                className="text-[10px] bg-amber-50 rounded px-2 py-1 border border-amber-100"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-gray-700 font-mono">#{order.orderId}</span>
                                  <span className="text-gray-600">{formatFlightTime(order.departureTime)}</span>
                                </div>
                                <div className="flex items-center justify-between mt-0.5">
                                  <span className="text-gray-600">✈️ {order.flightCode}</span>
                                  <span className="text-gray-600">{order.weight}kg</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Marker>
        );
      })}

      {children}
    </Map>
  );
}