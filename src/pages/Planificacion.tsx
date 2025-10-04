import { Calendar, TrendingUp } from 'lucide-react';

export default function Planificacion() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#FF6600] text-white px-8 py-6">
        <h1 className="text-3xl font-bold">Planificación Logística</h1>
        <p className="text-lg mt-1">Optimiza rutas y gestiona recursos de manera eficiente</p>
      </div>

      <div className="p-8">
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
              <Calendar className="w-10 h-10 text-gray-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Módulo de Planificación</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Este módulo está en desarrollo y pronto estará disponible para ayudarte a planificar
            y optimizar las operaciones logísticas de manera más eficiente.
          </p>
        </div>
      </div>
    </div>
  );
}
