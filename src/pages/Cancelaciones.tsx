import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { 
  AlertTriangle, 
  Upload, 
  X, 
  Calendar, 
  Plane,
  FileText,
  CheckCircle,
  XCircle,
  RefreshCcw,
  Trash2
} from 'lucide-react';
import { 
  uploadCancelacionesFile,
  obtenerCancelacionesActivas,
  limpiarCancelacionesAntiguas,
  VueloCancelado,
  VueloCancelacionResponse
} from '../services/apicancelaciones';

export default function Cancelaciones() {
  // Estados principales
  const [cancelaciones, setCancelaciones] = useState<VueloCancelado[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para subida de archivo
  const [isUploading, setIsUploading] = useState(false);
  const [fechaSeleccionada, setFechaSeleccionada] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Estados para resultado de carga
  const [showResultModal, setShowResultModal] = useState(false);
  const [uploadResult, setUploadResult] = useState<VueloCancelacionResponse | null>(null);
  
  // Filtros
  const [filtroOrigen, setFiltroOrigen] = useState('Todos');
  const [filtroDestino, setFiltroDestino] = useState('Todos');
  const [filtroFecha, setFiltroFecha] = useState('');

  // Cargar cancelaciones al montar
  useEffect(() => {
    fetchCancelaciones();
  }, []);

  // Fetch cancelaciones activas
  const fetchCancelaciones = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await obtenerCancelacionesActivas();
      setCancelaciones(response.cancelaciones);
    } catch (err: any) {
      setError(err.message || 'Error al cargar cancelaciones');
    } finally {
      setLoading(false);
    }
  };

  // Handler para botón de upload
  const handleUploadClick = () => {
    if (!fechaSeleccionada) {
      alert('Por favor selecciona una fecha para los vuelos cancelados');
      return;
    }
    fileInputRef.current?.click();
  };

  // Handler para cambio de archivo
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar que sea .txt
    if (!file.name.endsWith('.txt')) {
      alert('Por favor selecciona un archivo .txt');
      e.target.value = '';
      return;
    }

    try {
      setIsUploading(true);
      setError(null);

      const result = await uploadCancelacionesFile(file, fechaSeleccionada);
      
      setUploadResult(result);
      setShowResultModal(true);

      // Recargar lista de cancelaciones
      await fetchCancelaciones();

    } catch (err: any) {
      console.error('Error subiendo cancelaciones:', err);
      setError(err.message || 'Error al procesar cancelaciones');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Handler para limpiar cancelaciones antiguas
  const handleLimpiarAntiguas = async () => {
    const dias = 30;
    if (!confirm(`¿Deseas eliminar cancelaciones de hace más de ${dias} días?`)) {
      return;
    }

    try {
      setLoading(true);
      const result = await limpiarCancelacionesAntiguas(dias);
      alert(`${result.eliminadas} cancelaciones eliminadas correctamente`);
      await fetchCancelaciones();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Obtener valores únicos para filtros
  const origenes = ['Todos', ...new Set(cancelaciones.map(c => c.origen))];
  const destinos = ['Todos', ...new Set(cancelaciones.map(c => c.destino))];

  // Filtrar cancelaciones
  const cancelacionesFiltradas = cancelaciones.filter(c => {
    const matchOrigen = filtroOrigen === 'Todos' || c.origen === filtroOrigen;
    const matchDestino = filtroDestino === 'Todos' || c.destino === filtroDestino;
    const matchFecha = !filtroFecha || c.fecha === filtroFecha;
    return matchOrigen && matchDestino && matchFecha;
  });

  // Estadísticas
  const stats = {
    total: cancelaciones.length,
    hoy: cancelaciones.filter(c => c.fecha === new Date().toISOString().split('T')[0]).length,
    origenes: new Set(cancelaciones.map(c => c.origen)).size,
    destinos: new Set(cancelaciones.map(c => c.destino)).size,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-800 flex items-center gap-3">
                <AlertTriangle className="w-10 h-10 text-red-600" />
                Cancelaciones de Vuelos
              </h1>
              <p className="text-gray-600 mt-2">
                Gestiona vuelos cancelados y reasigna pedidos automáticamente
              </p>
            </div>
            <button
              onClick={fetchCancelaciones}
              disabled={loading}
              className="px-4 py-2 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] disabled:bg-gray-400 font-medium flex items-center gap-2 shadow-lg transition-all"
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refrescar
            </button>
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-red-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Total Cancelaciones</p>
                  <p className="text-3xl font-bold text-gray-800 mt-1">{stats.total}</p>
                </div>
                <AlertTriangle className="w-10 h-10 text-red-500 opacity-20" />
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-orange-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Hoy</p>
                  <p className="text-3xl font-bold text-gray-800 mt-1">{stats.hoy}</p>
                </div>
                <Calendar className="w-10 h-10 text-orange-500 opacity-20" />
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Orígenes Afectados</p>
                  <p className="text-3xl font-bold text-gray-800 mt-1">{stats.origenes}</p>
                </div>
                <Plane className="w-10 h-10 text-blue-500 opacity-20" />
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Destinos Afectados</p>
                  <p className="text-3xl font-bold text-gray-800 mt-1">{stats.destinos}</p>
                </div>
                <Plane className="w-10 h-10 text-purple-500 opacity-20" />
              </div>
            </div>
          </div>
        </div>

        {/* Panel de carga de archivo */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Cargar Cancelaciones
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de los vuelos
              </label>
              <input
                type="date"
                value={fechaSeleccionada}
                onChange={(e) => setFechaSeleccionada(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600] focus:border-transparent"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Archivo de cancelaciones (.txt)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={handleUploadClick}
                disabled={isUploading || !fechaSeleccionada}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-medium flex items-center justify-center gap-2 transition-all"
              >
                {isUploading ? (
                  <>
                    <RefreshCcw className="w-4 h-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Seleccionar archivo
                  </>
                )}
              </button>
            </div>
            
            <div>
              <button
                onClick={handleLimpiarAntiguas}
                disabled={loading}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 font-medium flex items-center justify-center gap-2 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Limpiar antiguas
              </button>
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
            <p className="text-sm text-blue-800 font-medium">ℹ️ Formato del archivo:</p>
            <p className="text-xs text-blue-700 mt-1 font-mono">
              ORIGEN-DESTINO-HH:mm-HH:mm-NNNN
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Ejemplo: SPIM-SKBO-04:35-08:51-0340
            </p>
          </div>
        </div>

        {/* Errores */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-700">{error}</span>
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Filtros</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Origen</label>
              <select
                value={filtroOrigen}
                onChange={(e) => setFiltroOrigen(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600] focus:border-transparent"
              >
                {origenes.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Destino</label>
              <select
                value={filtroDestino}
                onChange={(e) => setFiltroDestino(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600] focus:border-transparent"
              >
                {destinos.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha</label>
              <input
                type="date"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Tabla de cancelaciones */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Vuelo</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Origen</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Destino</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Fecha</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Hora Salida</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Hora Llegada</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Capacidad</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Cancelado En</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {cancelacionesFiltradas.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono font-semibold text-gray-800">
                        {c.origen}-{c.destino}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{c.origen}</td>
                    <td className="px-6 py-4 text-gray-700">{c.destino}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        {new Date(c.fecha).toLocaleDateString('es-PE')}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-700">{c.horaSalidaLocal}</td>
                    <td className="px-6 py-4 font-mono text-gray-700">{c.horaLlegadaLocal}</td>
                    <td className="px-6 py-4 text-gray-700">{c.capacidadMaxima}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(c.canceladoEn).toLocaleString('es-PE')}
                    </td>
                  </tr>
                ))}
                {!loading && cancelacionesFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No hay cancelaciones registradas</p>
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center">
                      <RefreshCcw className="w-6 h-6 text-gray-400 mx-auto mb-2 animate-spin" />
                      <p className="text-gray-500">Cargando cancelaciones...</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Modal de resultado */}
      {showResultModal && uploadResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
            {/* Header */}
            <div className={`${uploadResult.exito ? 'bg-green-600' : 'bg-red-600'} text-white px-6 py-4 flex items-center justify-between rounded-t-2xl`}>
              <div className="flex items-center gap-3">
                {uploadResult.exito ? (
                  <CheckCircle className="w-8 h-8" />
                ) : (
                  <XCircle className="w-8 h-8" />
                )}
                <div>
                  <h2 className="text-2xl font-bold">
                    {uploadResult.exito ? 'Procesado Exitosamente' : 'Error al Procesar'}
                  </h2>
                  <p className="text-sm opacity-90">{uploadResult.mensaje}</p>
                </div>
              </div>
              <button
                onClick={() => setShowResultModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700 font-medium">Vuelos Registrados</p>
                  <p className="text-3xl font-bold text-green-800 mt-1">
                    {uploadResult.vuelosRegistrados}
                  </p>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <p className="text-sm text-yellow-700 font-medium">Vuelos Duplicados</p>
                  <p className="text-3xl font-bold text-yellow-800 mt-1">
                    {uploadResult.vuelosDuplicados}
                  </p>
                </div>
                
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <p className="text-sm text-orange-700 font-medium">Pedidos Afectados</p>
                  <p className="text-3xl font-bold text-orange-800 mt-1">
                    {uploadResult.pedidosAfectados}
                  </p>
                </div>
                
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <p className="text-sm text-red-700 font-medium">Rutas Eliminadas</p>
                  <p className="text-3xl font-bold text-red-800 mt-1">
                    {uploadResult.rutasEliminadas}
                  </p>
                </div>
              </div>

              {uploadResult.pedidosReasignados.length > 0 && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700 font-medium mb-2">
                    Pedidos Reseteados para Reasignación ({uploadResult.pedidosReasignados.length})
                  </p>
                  <div className="max-h-40 overflow-y-auto">
                    <div className="flex flex-wrap gap-2">
                      {uploadResult.pedidosReasignados.slice(0, 20).map(id => (
                        <span key={id} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-mono">
                          {id}
                        </span>
                      ))}
                      {uploadResult.pedidosReasignados.length > 20 && (
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                          +{uploadResult.pedidosReasignados.length - 20} más
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {uploadResult.errores && uploadResult.errores.length > 0 && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <p className="text-sm text-red-700 font-medium mb-2">Errores:</p>
                  <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                    {uploadResult.errores.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t rounded-b-2xl">
              <button
                onClick={() => setShowResultModal(false)}
                className="w-full px-6 py-3 bg-[#FF6600] hover:bg-[#e55d00] text-white rounded-lg font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}