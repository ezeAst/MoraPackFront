import { Package } from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'pedidos', label: 'Pedidos' },
    { id: 'almacenes', label: 'Almacenes' },
    { id: 'vuelos', label: 'Vuelos' },
    { id: 'planificacion', label: 'Planificacion' },
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
              className={`px-6 py-4 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#FF6600] text-white'
                  : 'text-white hover:bg-[#004080]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
