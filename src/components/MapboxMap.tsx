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
      {routes.map((route) => (
        <Source
          key={route.id}
          id={route.id}
          type="geojson"
          data={{
            type: 'Feature',
            properties: { color: route.color },
            geometry: {
              type: 'LineString',
              coordinates: route.coordinates
            }
          }}
        >
          <Layer {...routeLayer} id={`${route.id}-layer`} />
        </Source>
      ))}

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
                className="absolute left-full ml-3 top-0 z-50 bg-white rounded-lg shadow-xl border border-gray-300 w-96 max-h-96 overflow-y-auto"
                style={{ pointerEvents: 'auto' }}
                onClick={(e) => e.stopPropagation()} // Evitar que el click dentro del tooltip lo cierre
                onMouseEnter={() => {
                  // Mantener hover cuando el mouse está sobre el tooltip
                  if (pinnedWarehouseCode !== warehouseId) {
                    setHoveredWarehouseCode(warehouseId);
                  }
                }}
                onMouseLeave={() => {
                  // Quitar hover cuando el mouse sale del tooltip (solo si no está pinned)
                  if (pinnedWarehouseCode !== warehouseId) {
                    setHoveredWarehouseCode(null);
                  }
                }}
              >
                {/* Header del warehouse */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 rounded-t-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-900">{warehouse.name}</h3>
                      <p className="text-sm text-gray-600">Código: {warehouse.codigo}</p>
                    </div>
                    {/* Botón de cerrar (solo aparece cuando está pinned) */}
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
                          width="20" 
                          height="20" 
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
                  {/* Indicador de que está pinned */}
                  {pinnedWarehouseCode === warehouseId && (
                    <p className="text-xs text-blue-600 mt-1">📌 Click fuera para cerrar o en otro almacén</p>
                  )}
                </div>

                <div className="p-4">
                  {/* Información de capacidad */}
                  {typeof warehouse.capacity === 'number' && typeof warehouse.current === 'number' && (
                    <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-blue-50 rounded p-2 border border-blue-200">
                        <p className="text-xs font-semibold text-blue-700">Capacidad</p>
                        <p className="text-gray-900 font-medium">{warehouse.current}/{warehouse.capacity}</p>
                      </div>
                      {typeof warehouse.occupancyPercentage === 'number' && (
                        <div className="bg-green-50 rounded p-2 border border-green-200">
                          <p className="text-xs font-semibold text-green-700">Ocupación</p>
                          <p className="text-gray-900 font-medium">{warehouse.occupancyPercentage.toFixed(1)}%</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lista de vuelos salientes */}
                  {warehouse.outgoingFlights && warehouse.outgoingFlights.length > 0 ? (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      {(() => {
                        // Filtrar solo vuelos programados (scheduled) y tomar los primeros 3
                        const scheduledFlights = warehouse.outgoingFlights
                          .filter(flight => flight.status === 'scheduled')
                          .slice(0, 3);
                        
                        if (scheduledFlights.length === 0) {
                          return (
                            <p className="text-sm text-gray-500 text-center italic">
                              No hay vuelos programados próximamente
                            </p>
                          );
                        }
                        
                        return (
                          <>
                            <h4 className="font-semibold text-md mb-2 flex items-center gap-2 text-gray-900">
                              ✈️ Próximos vuelos ({scheduledFlights.length})
                            </h4>
                            <div className="space-y-2">
                              {scheduledFlights.map((flight, idx) => (
                                <div 
                                  key={idx} 
                                  className="rounded p-2 text-xs border bg-gray-50 border-gray-200"
                                >
                                  <div className="grid grid-cols-2 gap-1">
                                    <p className="font-semibold text-gray-700 col-span-2">
                                      {flight.flightCode}
                                    </p>
                                    <p className="text-xs text-gray-600 col-span-2">
                                      ⏰ Programado
                                    </p>
                                    <p className="col-span-2 text-gray-600 mt-1">
                                      <span className="font-semibold">→</span> {flight.destination}
                                    </p>
                                    <p className="text-gray-600">
                                      <span className="font-semibold">Salida:</span>{' '}
                                      {formatFlightTime(flight.departureTime)}
                                    </p>
                                    <p className="text-gray-600 text-right">
                                      {flight.packages} kg ({flight.occupancyPercentage.toFixed(0)}%)
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-sm text-gray-500 text-center italic">
                        No hay vuelos programados desde este almacén
                      </p>
                    </div>
                  )}

                  {/* Lista de pedidos próximos a salir */}
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    {(() => {
                      console.log('🔍 DEBUG warehouse:', {
                        name: warehouse.name,
                        outgoingOrders: warehouse.outgoingOrders,
                        hasOrders: !!warehouse.outgoingOrders,
                        ordersLength: warehouse.outgoingOrders?.length
                      });
                      
                      if (!warehouse.outgoingOrders || warehouse.outgoingOrders.length === 0) {
                        return (
                          <p className="text-sm text-gray-500 text-center italic">
                            No hay pedidos programados desde este almacén
                          </p>
                        );
                      }
                      
                      // Tomar solo los primeros 3 pedidos
                      const nextOrders = warehouse.outgoingOrders.slice(0, 3);
                      
                      return (
                        <>
                          <h4 className="font-semibold text-md mb-2 flex items-center gap-2 text-gray-900">
                            📦 Próximos pedidos ({nextOrders.length})
                          </h4>
                          <div className="space-y-2">
                            {nextOrders.map((order, idx) => (
                              <div 
                                key={idx} 
                                className="rounded p-2 text-xs border bg-amber-50 border-amber-200"
                              >
                                <div className="grid grid-cols-2 gap-1">
                                  <p className="font-semibold text-gray-700 col-span-2 font-mono">
                                    {order.orderId}
                                  </p>
                                  <p className="text-xs text-gray-600 col-span-2">
                                    ✈️ Vuelo: {order.flightCode}
                                  </p>
                                  <p className="col-span-2 text-gray-600 mt-1">
                                    <span className="font-semibold">→</span> {order.destination}
                                  </p>
                                  <p className="text-gray-600">
                                    <span className="font-semibold">Salida:</span>{' '}
                                    {formatFlightTime(order.departureTime)}
                                  </p>
                                  <p className="text-gray-600 text-right">
                                    {order.weight} kg
                                  </p>
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