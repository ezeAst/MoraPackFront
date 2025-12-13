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

  // Determinar el tab activo basado en la ruta
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return 'dashboard';
    if (path.includes('/pedidos')) return 'pedidos';
    if (path.includes('/almacenes')) return 'almacenes';
    if (path.includes('/vuelos')) return 'vuelos';
    if (path.includes('/simulacion')) return 'simulacion';
    return 'dashboard';
  };

  const activeTab = getActiveTab();

  // Función para cambiar de tab (actualiza la ruta)
  const handleTabChange = (tab: string) => {
    navigate(`/${tab}`);
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <Navigation activeTab={activeTab} onTabChange={handleTabChange} />
      <div className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/almacenes" element={<Almacenes />} />
          <Route path="/vuelos" element={<Vuelos />} />
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