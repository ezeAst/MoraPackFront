import { useState } from 'react';
import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard';
import Pedidos from './pages/Pedidos';
import Almacenes from './pages/Almacenes';
import Vuelos from './pages/Vuelos';
import Simulacion from './pages/Simulacion';
import { SimulationProvider } from './contexts/SimulationContext';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'pedidos':
        return <Pedidos />;
      case 'almacenes':
        return <Almacenes />;
      case 'vuelos':
        return <Vuelos />;
      case 'simulacion':
        return <Simulacion />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <SimulationProvider>
      <div className="min-h-screen bg-gray-50">
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
        {renderPage()}
      </div>
    </SimulationProvider>
  );
}

export default App;
