import { useRef, useEffect } from 'react';
import Map, { Marker, Source, Layer, MapRef } from 'react-map-gl';
import type { LayerProps } from 'react-map-gl';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

type Warehouse = {
  name: string;
  lat: number;
  lng: number;
  status: 'normal' | 'warning' | 'critical' | 'full';
  capacity?: number;
  current?: number;
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
};

export default function MapboxMap({ warehouses, routes = [], children, onMapLoad }: Props) {
  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    if (mapRef.current && onMapLoad) {
      onMapLoad(mapRef.current.getMap());
    }
  }, [onMapLoad]);

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
        projection={{ name: 'mercator' }}  // ← AÑADE ESTA LÍNEA
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
      {warehouses.map((warehouse, i) => (
        <Marker
          key={i}
          longitude={warehouse.lng}
          latitude={warehouse.lat}
        >
          <div className="relative group">
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
                className="w-6 h-6 rounded-full border-2 border-white shadow-lg cursor-pointer transition-transform hover:scale-125"
                style={{ backgroundColor: getWarehouseColor(warehouse.status) }}
              />
            )}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {warehouse.name}{typeof warehouse.capacity === 'number' && typeof warehouse.current === 'number' ? ` — ${warehouse.current}/${warehouse.capacity}` : ''}
            </div>
          </div>
        </Marker>
      ))}

      {children}
    </Map>
  );
}