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
  progress?: number;
};

type Props = {
  warehouses: Warehouse[];
  routes?: Route[];
  children?: React.ReactNode;
  onMapLoad?: (map: mapboxgl.Map) => void;
  onWarehouseClick?: (codigoAlmacen: string) => void;
  highlightedWarehouse?: string;
  highlightedFlight?: string;
};

export default function MapboxMap({ warehouses, routes = [], children, onMapLoad, onWarehouseClick, highlightedWarehouse, highlightedFlight }: Props) {
  const mapRef = useRef<MapRef>(null);
  const [hoveredWarehouseCode, setHoveredWarehouseCode] = useState<string | null>(null);
  const [pinnedWarehouseCode, setPinnedWarehouseCode] = useState<string | null>(null);

  useEffect(() => {
    if (mapRef.current && onMapLoad) {
      onMapLoad(mapRef.current.getMap());
    }
  }, [onMapLoad]);

  useEffect(() => {
    const handleClickOutside = () => {
      if (pinnedWarehouseCode) {
        setPinnedWarehouseCode(null);
      }
    };

    if (pinnedWarehouseCode) {
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [pinnedWarehouseCode]);

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

  const getWarehouseColor = (status: string) => {
    switch (status) {
      case 'critical': return '#DC3545';
      case 'full': return '#DC3545';
      case 'warning': return '#FFC107';
      case 'normal': return '#28A745';
      default: return '#6B7280';
    }
  };


  const trimLineByProgress = (coords: [number, number][], progress?: number): [number, number][] => {
    if (!coords || coords.length < 2) return coords;
    const p = Math.max(0, Math.min(1, progress ?? 0));
    if (p <= 0) return coords;
    if (p >= 1) return [coords[coords.length - 1]];

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
        const t = segLen === 0 ? 1 : remainingInSeg / segLen;
        const [x1, y1] = coords[i];
        const [x2, y2] = coords[i + 1];
        const xi = x1 + (x2 - x1) * t;
        const yi = y1 + (y2 - y1) * t;
        return [[xi, yi], ...coords.slice(i + 1)];
      }
      acc += segLen;
    }
    return [coords[coords.length - 1]];
  };

  const warehouseIconCities = ['Baku', 'Bruselas', 'Lima'];
  
  // Verificar si hay un almacén destacado
  const isHighlighted = (codigo: string) => highlightedWarehouse === codigo;

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
      {routes.map((route) => {
        const trimmed = trimLineByProgress(route.coordinates, route.progress);
        console.log(`🗺️ Renderizando ruta ${route.id}:`, {
          original: route.coordinates,
          trimmed: trimmed,
          trimmedLength: trimmed?.length,
          progress: route.progress,
          color: route.color
        });
        
        return (
          <Source
            key={route.id}
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
            <Layer 
              id={`route-${route.id}`}
              type="line"
              paint={{
                'line-width': 3,
                'line-color': ['get', 'color'],
                'line-dasharray': [2, 2]
              }}
            />
          </Source>
        );
      })}

      {warehouses.map((warehouse) => {
        const warehouseId = `${warehouse.codigo}-${warehouse.name}`;
        const highlighted = isHighlighted(warehouse.codigo);

        return (
          <Marker
            key={warehouseId}
            longitude={warehouse.lng}
            latitude={warehouse.lat}
            anchor="center"
          >
            <div
              onClick={(e) => {
                e.stopPropagation();
                setPinnedWarehouseCode((prev) => (prev === warehouseId ? null : warehouseId));
                if (onWarehouseClick) {
                  onWarehouseClick(warehouse.codigo);
                }
              }}
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
              style={{ cursor: 'pointer', position: 'relative' }}
            >
              {/* ETIQUETA DESTACADA ANIMADA */}
              
              {warehouseIconCities.includes(warehouse.name) ? (
                <svg
                  width={highlighted ? "36" : "24"}
                  height={highlighted ? "36" : "24"}
                  viewBox="0 0 24 24"
                  className={`cursor-pointer transition-all ${highlighted ? 'drop-shadow-2xl' : 'hover:scale-125'}`}
                  style={{ 
                    fill: getWarehouseColor(warehouse.status),
                    filter: highlighted ? 'drop-shadow(0 0 8px rgba(255, 102, 0, 0.8))' : 'none'
                  }}
                >
                  <path d="M12 3L2 9v12h20V9L12 3zm0 2.21l6 3.6v1.2h-12v-1.2l6-3.6zM4 19v-8h16v8H4zm2-6h12v4H6v-4z"/>
                </svg>
              ) : (
                <div
                  className={`rounded-full border-2 border-white shadow-lg cursor-pointer transition-all ${
                    highlighted ? 'w-6 h-6 ring-4 ring-[#FF6600] ring-opacity-70' : 'w-4 h-4 hover:scale-125'
                  }`}
                  style={{ 
                    backgroundColor: getWarehouseColor(warehouse.status),
                    boxShadow: highlighted ? '0 0 20px rgba(255, 102, 0, 0.8)' : undefined
                  }}
                />
              )}

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

      {warehouses.flatMap((warehouse) =>
        (warehouse.outgoingFlights ?? [])
          .filter(flight => flight.status === 'in_flight')
          .map((flight) => (
            <Marker
              key={`flight-${flight.id}`}
              longitude={warehouse.lng}
              latitude={warehouse.lat}
              anchor="bottom"
            >
              <div
                title={`Vuelo ${flight.flightCode} hacia ${flight.destination}`}
                style={{
                  transform: highlightedFlight === flight.id ? 'scale(1.4)' : 'scale(1)',
                  transition: 'transform 0.2s',
                  zIndex: highlightedFlight === flight.id ? 100 : 1,
                }}
              >
                {/* Puedes cambiar este SVG por otro icono de avión si lo prefieres */}
                <svg width="28" height="28" viewBox="0 0 24 24" fill={highlightedFlight === flight.id ? "#2563eb" : "#FF6600"}>
                  <path d="M2.5 19.5l19-7-19-7v6l15 1-15 1z"/>
                </svg>
              </div>
            </Marker>
          ))
      )}

      {children}
    </Map>
  );
}