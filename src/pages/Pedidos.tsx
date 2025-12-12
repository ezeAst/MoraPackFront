import { useState, useEffect } from 'react';
import { Package, Clock, DollarSign } from 'lucide-react';
import Papa from 'papaparse';
import type { Order, Client, Route } from '../types';
import { parsePedidosTxt } from '../utils/parsePedidosTxt';
import { importarPedidosCompleto } from '../services/apiPedidos';
import { getDestinos } from '../services/apiDestinos';

const MOCK_CLIENTS: Client[] = [
  { id: '1', first_name: 'Juan', last_name: 'Pérez', birth_date: '1990-01-01', email: 'juan@example.com', phone: '123456789', created_at: '2025-10-01T09:00:00Z' },
  { id: '2', first_name: 'Ana', last_name: 'García', birth_date: '1985-05-12', email: 'ana@example.com', phone: '987654321', created_at: '2025-10-01T09:05:00Z' },
  { id: '3', first_name: 'Luis', last_name: 'Martínez', birth_date: '1992-08-20', email: 'luis@example.com', phone: '555555555', created_at: '2025-10-01T09:10:00Z' }
];

const MOCK_ORDERS: Order[] = [
  { id: '101', order_code: 'MPE-001', client_id: '1', product_quantity: 10, destination_city: 'Madrid', delivery_date: '2025-10-10', status: 'processing', created_at: '2025-10-01T10:00:00Z' },
  { id: '102', order_code: 'MPE-002', client_id: '2', product_quantity: 5, destination_city: 'Bogotá', delivery_date: '2025-10-12', status: 'completed', created_at: '2025-10-02T11:00:00Z' }
];

const MESES = [
  { value: 1,  label: 'Enero' },
  { value: 2,  label: 'Febrero' },
  { value: 3,  label: 'Marzo' },
  { value: 4,  label: 'Abril' },
  { value: 5,  label: 'Mayo' },
  { value: 6,  label: 'Junio' },
  { value: 7,  label: 'Julio' },
  { value: 8,  label: 'Agosto' },
  { value: 9,  label: 'Setiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

const WAREHOUSE_ICAO = new Set(["SPIM", "EBCI", "UBBB"]);

const ICAO_TO_CITY: Record<string, string> = {
  SPIM: "Lima",
  EBCI: "Bruselas",
  UBBB: "Baku",
};

const PEDIDO_RE = /^(\d{2})-(\d{2})-(\d{2})-([A-Z]{4})-(\d{3})-(\d{7})$/;

function isValidDay(dd: string)   { const v = +dd; return v >= 1 && v <= 31; }
function isValidHour(hh: string)  { const v = +hh; return v >= 0 && v <= 23; }
function isValidMin(mm: string)   { const v = +mm; return v >= 0 && v <= 59; }
function isValidQty(q: string)    { const v = +q;  return v >= 1 && v <= 999; }

let orderIdCounter = 103;
let clientIdCounter = 4;

export default function Pedidos() {
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [calculatedRoute, setCalculatedRoute] = useState<Route | null>(null);
  const [destinos, setDestinos] = useState<string[]>([]);
  const [destinosLoading, setDestinosLoading] = useState(false);
  const [destinosError, setDestinosError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    productQuantity: '',
    destinationCity: '',
    deliveryDate: ''
  });

  const [newClient, setNewClient] = useState({
    firstName: '',
    lastName: '',
    birthDate: '',
    email: '',
    phone: ''
  });

  // ✅ CAMBIO 1: Estado para múltiples archivos
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    loadOrders();

    (async () => {
      try {
        setDestinosLoading(true);
        setDestinosError(null);
        const data = await getDestinos();
        setDestinos(data);
      } catch (e: any) {
        setDestinosError(e.message || 'Error cargando destinos');
      } finally {
        setDestinosLoading(false);
      }
    })();
  }, []);

  const loadOrders = () => {
    setOrders([...MOCK_ORDERS].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5));
  };

  const searchClients = () => {
    const filtered = MOCK_CLIENTS.filter(c =>
      c.first_name.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 12);
    setClients(filtered);
  };

  // ✅ CAMBIO 2: onSelect para múltiples archivos
  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      setFiles(Array.from(selectedFiles));
    }
  };

 // ================================================================
// VERSIÓN ROBUSTA - Detecta y maneja archivos problemáticos
// ================================================================

const onUpload = async () => {
  if (files.length === 0) { 
    alert('Selecciona al menos un archivo TXT'); 
    return; 
  }

  // Solo permitir 1 archivo a la vez si es muy grande
  const archivosGrandes = files.filter(f => f.size > 3 * 1024 * 1024); // >3MB
  if (archivosGrandes.length > 0 && files.length > 1) {
    alert(
      `⚠️ Archivos grandes detectados:\n\n` +
      archivosGrandes.map(f => `  - ${f.name} (${(f.size/1024/1024).toFixed(1)} MB)`).join('\n') +
      `\n\nPor favor, carga archivos grandes INDIVIDUALMENTE (uno a la vez).`
    );
    return;
  }

  setLoading(true);
  setProgress(0);
  
  try {
    const todosPedidos: any[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`📄 [${i + 1}/${files.length}] ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
      
      try {
        const txt = await file.text();
        const lines = txt.split('\n').filter(line => line.trim());
        
        console.log(`  📊 Total líneas: ${lines.length.toLocaleString()}`);
        
        // Procesar en chunks pequeños para evitar stack overflow
        const CHUNK_SIZE = 5000;
        let pedidosArchivo = 0;
        
        for (let j = 0; j < lines.length; j += CHUNK_SIZE) {
          const chunk = lines.slice(j, j + CHUNK_SIZE).join('\n');
          const pedidosChunk = parsePedidosTxt(chunk);
          
          if (pedidosChunk.length > 0) {
            todosPedidos.push(...pedidosChunk);
            pedidosArchivo += pedidosChunk.length;
          }
          
          // Actualizar progreso
          const fileProgress = ((j + CHUNK_SIZE) / lines.length) * 100;
          const totalProgress = ((i + (fileProgress / 100)) / files.length) * 30;
          setProgress(Math.round(totalProgress));
          
          // Pequeña pausa para no bloquear el navegador
          await new Promise(resolve => setTimeout(resolve, 1));
        }
        
        console.log(`  ✅ ${pedidosArchivo.toLocaleString()} pedidos parseados`);
        
      } catch (error: any) {
        console.error(`  ❌ Error: ${error.message}`);
        alert(`❌ Error procesando ${file.name}:\n\n${error.message}`);
        return;
      }
    }

    if (todosPedidos.length === 0) {
      alert('No se encontraron pedidos válidos.');
      return;
    }

    console.log(`📦 Total: ${todosPedidos.length.toLocaleString()} pedidos`);

    // Enviar al backend
    setProgress(30);
    const startTime = Date.now();
    
    const resp = await importarPedidosCompleto(todosPedidos, (prog) => {
      setProgress(30 + Math.round((prog / 100) * 70));
    });
    
    const endTime = Date.now();
    const tiempoTotal = endTime - startTime;

    alert(
      `✅ Importación completada:\n\n` +
      `📦 Pedidos: ${resp.insertados.toLocaleString()}\n` +
      `⚡ Tiempo: ${(tiempoTotal / 1000).toFixed(1)}s\n` +
      `🚀 Velocidad: ${(resp.pedidosPorSegundo || 0).toLocaleString()} pedidos/seg`
    );

    const inputEl = document.getElementById('file-pedidos') as HTMLInputElement | null;
    if (inputEl) inputEl.value = '';
    setFiles([]);
    setProgress(0);
    
  } catch (e: any) {
    console.error('Error:', e);
    alert(`❌ Error: ${e.message}`);
  } finally {
    setLoading(false);
    setProgress(0);
  }
};

  const handleRegisterClient = () => {
    const newId = String(clientIdCounter++);
    const client: Client = {
      id: newId,
      first_name: newClient.firstName,
      last_name: newClient.lastName,
      birth_date: newClient.birthDate,
      email: newClient.email,
      phone: newClient.phone,
      created_at: new Date().toISOString()
    };
    MOCK_CLIENTS.push(client);
    setSelectedClient(client);
    setShowNewClientModal(false);
    setNewClient({ firstName: '', lastName: '', birthDate: '', email: '', phone: '' });
  };

  const handleCalculateRoute = () => {
    const routes = [
      { path: 'Bruselas → Estambul → Baku', time: 1.8, cost: 1950 },
      { path: 'Lima → Madrid → Baku', time: 2.5, cost: 2200 },
      { path: 'Lima → Bruselas → Mumbai', time: 3.2, cost: 2800 }
    ];

    const randomRoute = routes[Math.floor(Math.random() * routes.length)];
    setCalculatedRoute({
      id: '',
      order_id: '',
      route_path: randomRoute.path,
      estimated_time_days: randomRoute.time,
      estimated_cost: randomRoute.cost,
      created_at: new Date().toISOString()
    });
  };

  const handleRegisterOrder = () => {
    if (!selectedClient || !formData.productQuantity || !formData.destinationCity || !formData.deliveryDate) {
      alert('Por favor completa todos los campos');
      return;
    }

    const orderCode = `MPE-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
    const newOrder: Order = {
      id: String(orderIdCounter++),
      order_code: orderCode,
      client_id: selectedClient.id,
      product_quantity: parseInt(formData.productQuantity),
      destination_city: formData.destinationCity,
      delivery_date: formData.deliveryDate,
      status: 'processing',
      created_at: new Date().toISOString()
    };

    MOCK_ORDERS.unshift(newOrder);
    setFormData({ productQuantity: '', destinationCity: '', deliveryDate: '' });
    setSelectedClient(null);
    setCalculatedRoute(null);
    loadOrders();
    alert('Pedido registrado exitosamente');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'in_transit': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'processing': return 'Procesando';
      case 'in_transit': return 'En Tránsito';
      case 'completed': return 'Terminado';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#FF6600] text-white px-8 py-6">
        <h1 className="text-3xl font-bold">Registro de pedidos</h1>
        <p className="text-lg mt-1">Registra nuevos envíos de productos MPE y calcular rutas óptimas</p>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <Package className="w-6 h-6 text-[#FF6600]" />
              <h2 className="text-xl font-bold text-gray-800">Nuevo Registro</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cliente</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={selectedClient ? `${selectedClient.first_name} ${selectedClient.last_name}` : ''}
                    placeholder="Selecciona un cliente"
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600] focus:border-transparent"
                  />
                  <button
                    onClick={() => setShowClientSearch(true)}
                    className="px-6 py-2 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] font-medium"
                  >
                    Buscar
                  </button>
                </div>
                <button
                  onClick={() => setShowNewClientModal(true)}
                  className="text-[#0066FF] text-sm mt-2 hover:underline"
                >
                  Registrar nuevo cliente
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad de Productos MPE</label>
                <input
                  type="number"
                  value={formData.productQuantity}
                  onChange={(e) => setFormData({ ...formData, productQuantity: e.target.value })}
                  placeholder="Ingrese cantidad"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ciudad Destino</label>
                <select
                  value={formData.destinationCity}
                  onChange={(e) =>
                    setFormData({ ...formData, destinationCity: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600] focus:border-transparent"
                >
                  <option value="">
                    {destinosLoading ? 'Cargando destinos...' : 'Selecciona destino'}
                  </option>
                  {destinosError && (
                    <option value="" disabled>
                      {destinosError}
                    </option>
                  )}
                  {destinos.map((ciudad) => (
                    <option key={ciudad} value={ciudad}>
                      {ciudad}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleRegisterOrder}
                className="w-full px-6 py-3 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] font-medium"
              >
                Registrar Pedido
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Pedidos recientes</h2>
              <div className="space-y-3">
                {orders.map((order) => (
                  <div key={order.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-800">{order.order_code}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{order.destination_city}</p>
                  </div>
                ))}
              </div>
            </div>

            {calculatedRoute && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="mb-4">
                  <div className="inline-block px-4 py-2 bg-blue-100 text-blue-800 rounded-lg font-medium">
                    Ruta Óptima Calculada
                  </div>
                </div>
                <p className="text-lg font-semibold text-gray-800 mb-4">
                  Ruta Recomendada: {calculatedRoute.route_path}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-5 h-5 text-green-600" />
                      <span className="text-sm text-gray-600">Tiempo Estimado</span>
                    </div>
                    <p className="text-2xl font-bold text-green-700">{calculatedRoute.estimated_time_days} días</p>
                  </div>
                  <div className="bg-pink-50 p-4 rounded-lg border border-pink-200">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-5 h-5 text-pink-600" />
                      <span className="text-sm text-gray-600">Costo Estimado</span>
                    </div>
                    <p className="text-2xl font-bold text-pink-700">${calculatedRoute.estimated_cost}</p>
                  </div>
                </div>
              </div>
            )}

            {/* ✅ CAMBIO 4: Card mejorado para carga masiva múltiple */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mt-6">
              <div className="flex items-center gap-3 mb-4">
                <Package className="w-6 h-6 text-[#0066FF]" />
                <h2 className="text-xl font-bold text-gray-800">Carga masiva de pedidos (CSV/TXT)</h2>
              </div>
              <div className="border-2 border-dashed border-[#0066FF] rounded-lg p-6 flex flex-col mt-2 items-center justify-center bg-blue-50">
                <input
                  id="file-pedidos"
                  type="file"
                  accept=".csv,.txt"
                  multiple
                  onChange={onSelect}
                  className="mb-4"
                />
                
                <span className="text-xs text-gray-500 mb-4">
                  {files.length > 0 
                    ? `${files.length} archivo(s) seleccionado(s)` 
                    : 'Arrastra o selecciona uno o varios archivos CSV/TXT con los pedidos'}
                </span>

                {/* Lista de archivos seleccionados */}
                {files.length > 0 && (
                  <div className="w-full mb-4 max-w-md">
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      Archivos seleccionados:
                    </p>
                    <ul className="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto bg-white p-3 rounded border border-gray-200">
                      {files.map((file, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span className="text-blue-600">📄</span>
                          <span className="flex-1 truncate">{file.name}</span>
                          <span className="text-gray-400 text-[10px]">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button 
                  onClick={onUpload} 
                  disabled={loading || files.length === 0} 
                  className="px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {loading 
                    ? `Procesando... ${progress}%` 
                    : files.length > 0 
                      ? `Cargar ${files.length} archivo(s)` 
                      : 'Cargar pedidos masivos'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showClientSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl mx-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Buscar cliente</h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ingrese nombre del cliente"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]"
              />
              <button
                onClick={searchClients}
                className="px-6 py-2 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00]"
              >
                Filtrar
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {clients.map((client) => (
                <div key={client.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <span className="text-gray-800">{client.first_name} {client.last_name}</span>
                  <button
                    onClick={() => {
                      setSelectedClient(client);
                      setShowClientSearch(false);
                    }}
                    className="px-4 py-2 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] text-sm"
                  >
                    Seleccionar
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowClientSearch(false)}
              className="mt-4 w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {showNewClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span>👤</span> Nuevo Registro de Cliente
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombres</label>
                <input
                  type="text"
                  value={newClient.firstName}
                  onChange={(e) => setNewClient({ ...newClient, firstName: e.target.value })}
                  placeholder="Ingrese Nombres"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Apellidos</label>
                <input
                  type="text"
                  value={newClient.lastName}
                  onChange={(e) => setNewClient({ ...newClient, lastName: e.target.value })}
                  placeholder="Ingrese Apellidos"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de nacimiento</label>
                <input
                  type="date"
                  value={newClient.birthDate}
                  onChange={(e) => setNewClient({ ...newClient, birthDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Correo electrónico</label>
                <input
                  type="email"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  placeholder="Ingrese correo"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Número de celular</label>
                <input
                  type="tel"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  placeholder="Ingrese número de celular"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]"
                />
              </div>

              <button
                onClick={handleRegisterClient}
                className="w-full px-6 py-3 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] font-medium"
              >
                Registrar cliente
              </button>

              <button
                onClick={() => setShowNewClientModal(false)}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}