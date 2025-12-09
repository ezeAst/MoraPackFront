import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard';
import Pedidos from './pages/Pedidos';
import Almacenes from './pages/Almacenes';
import Vuelos from './pages/Vuelos';
import Simulacion from './pages/Simulacion';
import { SimulationProvider } from './contexts/SimulationContext';

// Componente interno que maneja la sincronización entre rutas y tabs
function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();

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
    <div className="h-screen bg-gray-50 overflow-hidden flex flex-col">
      <Navigation activeTab={activeTab} onTabChange={handleTabChange} />
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/almacenes" element={<Almacenes />} />
          <Route path="/vuelos" element={<Vuelos />} />
          <Route path="/planificacion" element={<Planificacion />} />
          <Route path="/simulacion" element={<Simulacion />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <SimulationProvider>
        <AppContent />
      </SimulationProvider>
    </BrowserRouter>
  );
}

export default App;