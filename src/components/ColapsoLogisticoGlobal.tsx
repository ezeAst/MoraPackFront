import React, { useState, useEffect } from 'react';
import { AlertCircle, Package, X } from 'lucide-react';

export function ColapsoLogisticoGlobal() {
  const [showColapso, setShowColapso] = useState(false);
  const [pedidosColapso, setPedidosColapso] = useState<any[]>([]);

  useEffect(() => {
    function revisarColapso() {
      const pedidos = JSON.parse(localStorage.getItem('pedidosColapso') || '[]');
      if (pedidos.length > 0) {
        setPedidosColapso(pedidos);
        setShowColapso(true);
      } else {
        setShowColapso(false);
        setPedidosColapso([]);
      }
    }

    // Revisar al montar
    revisarColapso();

    // Revisar cada 2 segundos
    const interval = setInterval(revisarColapso, 2000);

    // Revisar cuando cambia el storage en otra pestaña
    function onStorage(e: StorageEvent) {
      if (e.key === 'colapsoLogistico' || e.key === 'pedidosColapso') {
        revisarColapso();
      }
    }
    window.addEventListener('storage', onStorage);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  function cerrarColapso() {
    setShowColapso(false);
    localStorage.removeItem('pedidosColapso');
    localStorage.removeItem('colapsoLogistico');
  }

  if (!showColapso) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[100] flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 text-center border-4 border-red-500 animate-pulse">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-red-700 mb-2">¡Colapso logístico detectado!</h2>
        <p className="mb-4 text-gray-700">
          Se han detectado pedidos sin asignar:
        </p>
        <ul className="mb-6 text-left max-h-40 overflow-y-auto">
          {pedidosColapso.map((p, idx) => (
            <li key={idx} className="mb-2 flex items-center gap-2 bg-red-50 p-2 rounded">
              <Package className="w-4 h-4 text-red-500" />
              <span className="font-bold text-gray-900">#{p.id}</span> — {p.destino} ({p.cantidad} paquetes)
            </li>
          ))}
        </ul>
        <button
          onClick={cerrarColapso}
          className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}