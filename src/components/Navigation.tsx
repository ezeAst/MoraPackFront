import { Package } from 'lucide-react';
import { useSimulation } from '../contexts/SimulationContext';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const { isRunning, progress } = useSimulation();
  
    // Asegurar que el progreso esté entre 0 y 100 para la visualización
    const safeProgress = Math.max(0, Math.min(100, progress || 0));

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'planificacion', label: 'Planificación' },
    { id: 'pedidos', label: 'Pedidos' },
    { id: 'almacenes', label: 'Almacenes' },
    { id: 'vuelos', label: 'Vuelos' },
    { id: 'simulacion', label: 'Simulacion' }
  ];

  return (
    <nav className="bg-[#003366] text-white">
      <div className="flex items-center">
        <div className="flex items-center gap-2 px-6 py-4">
          <Package className="w-8 h-8" />
          <span className="text-xl font-bold">MoraPack</span>
        </div>

        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-6 py-4 font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'bg-[#FF6600] text-white'
                  : 'text-white hover:bg-[#004080]'
              }`}
            >
              {tab.label}
              {/* Indicador de simulación activa en la pestaña Simulación */}
              {tab.id === 'simulacion' && isRunning && (
                <span className="absolute top-2 right-2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Barra de progreso global cuando hay simulación activa */}
        {isRunning && (
          <div className="ml-auto px-6 py-2 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm font-medium">Simulación en curso</span>
            </div>
            <div className="w-32 h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${safeProgress}%` }}
              />
            </div>
              <span className="text-sm font-mono">{safeProgress.toFixed(0)}%</span>
          </div>
        )}
      </div>
    </nav>
  );
}
