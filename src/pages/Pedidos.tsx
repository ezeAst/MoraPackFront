import { useState, useEffect } from 'react';
import { Package, Clock, DollarSign } from 'lucide-react';
import Papa from 'papaparse'; // Asegúrate de instalar papaparse: npm install papaparse
import type { Order, Client, Route } from '../types';
import { parsePedidosTxt } from '../utils/parsePedidosTxt';
import { importarPedidos } from '../services/apiPedidos';
import { getDestinos } from '../services/apiDestinos';
import { importarPedidosEnLotes } from '../services/apiPedidos'; // ✅ Cambiar import
import type { Destino } from '../services/apiDestinos';
import { crearPedido } from '../services/apiPedidos';
import { getPedidosRecientes } from "../services/apiPedidos";

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

// Almacenes principales (se excluyen de la planificación)
const WAREHOUSE_ICAO = new Set(["SPIM", "EBCI", "UBBB"]);

// (Opcional) mapa ICAO -> Ciudad visible en UI
const ICAO_TO_CITY: Record<string, string> = {
  SPIM: "Lima",
  EBCI: "Bruselas",
  UBBB: "Baku",
  // agrega más según tu lista de aeropuertos
};

// Regex exacto del formato
const PEDIDO_RE = /^(\d{2})-(\d{2})-(\d{2})-([A-Z]{4})-(\d{3})-(\d{7})$/;

// Validaciones de rango
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
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [selectedDestino, setSelectedDestino] = useState<Destino | null>(null);
  const [destinosLoading, setDestinosLoading] = useState(false);
  const [destinosError, setDestinosError] = useState<string | null>(null);

  /*const [formData, setFormData] = useState({
    productQuantity: '',
    destinationCity: '',
    deliveryDate: ''
  });*/

  const [formData, setFormData] = useState({
  clientId: '',          // nuevo
  productQuantity: '',
  destinationCity: '',
});

  const [newClient, setNewClient] = useState({
    firstName: '',
    lastName: '',
    birthDate: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    loadOrders();

    (async () => {
      try {
        setDestinosLoading(true);
        setDestinosError(null);
        const data = await getDestinos();
        setDestinos(data);
        console.log('DESTINOS:', data);
        console.log('PRIMER DESTINO:', data?.[0]);
      } catch (e: any) {
        setDestinosError(e.message || 'Error cargando destinos');
      } finally {
        setDestinosLoading(false);
      }
    })();
  }, []);

const loadOrders = async () => {
  try {
    const rec = await getPedidosRecientes(3);

    const uiOrders: Order[] = rec.map((p) => ({
      id: String(p.id),
      order_code: `PED-${p.id}`,
      client_id: p.id_cliente,
      product_quantity: p.cantidad,
      destination_city: p.aeropuerto_destino, // luego si quieres lo mapeamos a nombre
      delivery_date: "",
      status: "processing",
      created_at: '???',
    }));

    setOrders(uiOrders);
  } catch (e) {
    console.error(e);
    setOrders([]); // si falla, que no rompa la pantalla
  }
};

  useEffect(() => {
    loadOrders();

    (async () => {
      try {
        setDestinosLoading(true);
        setDestinosError(null);
        const data = await getDestinos();
        setDestinos(data);
      } catch (e: any) {
        setDestinosError(e.message || "Error cargando destinos");
      } finally {
        setDestinosLoading(false);
      }
    })();
  }, []);

  const searchClients = () => {
    const filtered = MOCK_CLIENTS.filter(c =>
      c.first_name.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 12);
    setClients(filtered);
  };

  const [file, setFile] = useState<File | null>(null);
  const [mes, setMes] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
  };


  const [progress, setProgress] = useState(0);

const onUpload = async () => {
  if (!file) { 
    alert('Selecciona un TXT'); 
    return; 
  }

  setLoading(true);
  setProgress(0);
  
  try {
    const txt = await file.text();
    const pedidos = parsePedidosTxt(txt); // ✅ Ya no necesita mes

    if (!pedidos.length) {
      alert('No se encontraron pedidos válidos.');
      return;
    }

    console.log(`📦 Pedidos parseados: ${pedidos.length}`);

    // ✅ USAR IMPORTACIÓN POR LOTES
    const resp = await importarPedidosEnLotes(pedidos, (prog) => {
      setProgress(prog);
    });

    alert(
      `✅ Importación completada:\n` +
      `- Insertados: ${resp.insertados}\n` +
      `- Duplicados: ${resp.duplicados}\n` +
      `- Errores: ${resp.errores}`
    );

    // Limpiar file input
    const inputEl = document.getElementById('file-pedidos') as HTMLInputElement | null;
    if (inputEl) inputEl.value = '';
    setFile(null);
    setProgress(0);
  } catch (e: any) {
    alert(e.message || 'Error al importar pedidos');
  } finally {
    setLoading(false);
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

  const handleRegisterOrder = async () => {
    if (!formData.clientId || !formData.productQuantity || !selectedDestino) {
      alert('Por favor completa todos los campos');
      return;
    }

    const qty = Number(formData.productQuantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      alert('Cantidad inválida');
      return;
    }

    // ✅ fecha/hora ajustada al destino usando husoHorario de la BD
    const createdAtDestino = getOrderDateForOffset(selectedDestino.husoHorario);

    try {
      // ✅ Llamada al backend
      const resp = await crearPedido({
        id_cliente: formData.clientId,
        cantidad: qty,
        aeropuerto_destino: selectedDestino.codigo,
        created_at: createdAtDestino,
      });

      // ✅ (Opcional) actualiza pedidos recientes en UI con algo “seguro”
      // Si tu backend devuelve el pedido completo, úsalo tal cual.
      // Si solo devuelve id/codigo, armamos uno mínimo para la lista.
      const orderForUI = {
        id: String(resp.id ?? Date.now()),
        order_code: resp.order_code ?? 'Pedido ',
        client_id: formData.clientId,
        product_quantity: qty,
        destination_city: selectedDestino.nombre,
        delivery_date: '',
        status: 'processing',
        created_at: createdAtDestino,
      } as Order;

      setOrders((prev) =>
        [orderForUI, ...prev]
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 5)
      );

      // ✅ limpiar
      setFormData({ clientId: '', productQuantity: '', destinationCity: '' });
      setSelectedDestino(null);
      setCalculatedRoute(null);

      alert(`✅ Pedido registrado correctamente.\n`);
      await loadOrders();
    } catch (e: any) {
      alert(e.message || 'Error al registrar pedido');
    }
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

  function getOrderDateForOffset(destOffsetHours: number): string {
    const now = new Date(); // hora local del navegador

    // offset local en minutos (Perú suele ser +300)
    const localOffsetMinutes = now.getTimezoneOffset();

    // local -> UTC
    const utcMillis = now.getTime() + localOffsetMinutes * 60 * 1000;

    // UTC -> destino
    const destMillis = utcMillis + destOffsetHours * 60 * 60 * 1000;
    const destDate = new Date(destMillis);

    const pad = (n: number) => n.toString().padStart(2, '0');

    // YYYY-MM-DDTHH:mm:ss
    return `${destDate.getFullYear()}-${pad(destDate.getMonth() + 1)}-${pad(
      destDate.getDate()
    )}T${pad(destDate.getHours())}:${pad(destDate.getMinutes())}:${pad(
      destDate.getSeconds()
    )}`;
  }



  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#FF6600] text-white px-8 py-6">
        <h1 className="text-3xl font-bold">Registro de pedidos</h1>
        <p className="text-lg mt-1">Registra nuevos envíos de productos MPE</p>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID del Cliente
                </label>
                <input
                  type="text"
                  value={formData.clientId}
                  onChange={(e) =>
                    setFormData({ ...formData, clientId: e.target.value })
                  }
                  placeholder="Ingrese ID de cliente (ej. 0034867)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600] focus:border-transparent"
                />
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
                 
                  value={selectedDestino?.codigo ?? ''}
                  onChange={(e) => {
                    const codigo = e.target.value;
                    const destino = destinos.find((d) => d.codigo === codigo) || null;
                    setSelectedDestino(destino);
                    setFormData({ ...formData, destinationCity: destino?.nombre ?? '' });
                  }}
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

                  {destinos.map((d) => (
                    <option key={d.codigo} value={d.codigo}>
                      {d.nombre}
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
                      <span className="font-bold text-gray-800">Pedido #{order.id}</span>
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

            {/* Card para carga masiva de pedidos */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mt-6">
              <div className="flex items-center gap-3 mb-4">
                <Package className="w-6 h-6 text-[#0066FF]" />
                <h2 className="text-xl font-bold text-gray-800">Carga masiva de pedidos (CSV/TXT)</h2>
              </div>
              <div className="border-2 border-dashed border-[#0066FF] rounded-lg p-6 flex flex-col mt-2 items-center justify-center bg-blue-50">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={onSelect}
                  className="mb-4"
                />
                <span className="text-xs text-gray-500 mb-4">Arrastra o selecciona un archivo CSV/TXT con los pedidos</span>
                    <button onClick={onUpload} disabled={loading} className="px-4 py-2 rounded bg-blue-600 text-white">
                      {loading ? `Procesando... ${progress}%` : 'Cargar pedidos masivos'}
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
