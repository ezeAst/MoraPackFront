import { useState } from 'react';
import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard';
import Pedidos from './pages/Pedidos';
import Almacenes from './pages/Almacenes';
import Vuelos from './pages/Vuelos';
import Planificacion from './pages/Planificacion';
import Simulacion from './pages/Simulacion';

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
      case 'planificacion':
        return <Planificacion />;
      case 'simulacion':
        return <Simulacion />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      {renderPage()}
    </div>
  );
}

export default App;
