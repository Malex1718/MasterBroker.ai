import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Eye, MessageCircle, Target, BarChart3, Clock, Activity } from 'lucide-react';

// Datos de ejemplo
const viewsData = [
  { date: '01/11', views: 45, leads: 2 },
  { date: '02/11', views: 52, leads: 3 },
  { date: '03/11', views: 48, leads: 2 },
  { date: '04/11', views: 70, leads: 5 },
  { date: '05/11', views: 65, leads: 4 },
  { date: '06/11', views: 85, leads: 6 },
  { date: '07/11', views: 78, leads: 5 }
];

const PropertyStatsDashboard = () => {
  const [timeRange, setTimeRange] = useState('7d');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Estadísticas de la Propiedad</h1>
        <select 
          className="p-2 border rounded-md"
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
        >
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
          <option value="90d">Últimos 90 días</option>
        </select>
      </div>

      {/* KPIs Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Eye className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Vistas</p>
            <p className="text-2xl font-bold">443</p>
            <p className="text-xs text-green-500">+12.5% vs periodo anterior</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center space-x-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <MessageCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Leads</p>
            <p className="text-2xl font-bold">27</p>
            <p className="text-xs text-green-500">+8.3% vs periodo anterior</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center space-x-4">
          <div className="p-3 bg-purple-100 rounded-lg">
            <Target className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Tasa de Conversión</p>
            <p className="text-2xl font-bold">6.1%</p>
            <p className="text-xs text-red-500">-2.1% vs periodo anterior</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center space-x-4">
          <div className="p-3 bg-orange-100 rounded-lg">
            <Activity className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Score de Calidad</p>
            <p className="text-2xl font-bold">85%</p>
            <p className="text-xs text-green-500">+5% vs periodo anterior</p>
          </div>
        </Card>
      </div>

      {/* Gráfico Principal */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Tendencia de Vistas y Leads</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={viewsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="views" stroke="#2563eb" name="Vistas" />
              <Line yAxisId="right" type="monotone" dataKey="leads" stroke="#16a34a" name="Leads" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Estadísticas Detalladas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Engagement */}
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">Engagement</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Tiempo promedio de vista</span>
              <span className="font-semibold">2m 45s</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Tasa de rebote</span>
              <span className="font-semibold">32%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Guardados en favoritos</span>
              <span className="font-semibold">18</span>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Distribución por dispositivo</p>
              <div className="bg-gray-200 h-4 rounded-full overflow-hidden">
                <div className="flex h-full">
                  <div className="bg-blue-500 w-3/5" title="Móvil 60%"></div>
                  <div className="bg-green-500 w-1/3" title="Desktop 33%"></div>
                  <div className="bg-yellow-500 w-[7%]" title="Tablet 7%"></div>
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Móvil 60%</span>
                <span>Desktop 33%</span>
                <span>Tablet 7%</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Leads */}
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">Estado de Leads</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Nuevos</span>
                <span className="font-semibold">8</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full">
                <div className="h-full w-[30%] bg-blue-500 rounded-full"></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">En contacto</span>
                <span className="font-semibold">12</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full">
                <div className="h-full w-[45%] bg-yellow-500 rounded-full"></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">En negociación</span>
                <span className="font-semibold">5</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full">
                <div className="h-full w-[20%] bg-green-500 rounded-full"></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Cerrados</span>
                <span className="font-semibold">2</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full">
                <div className="h-full w-[5%] bg-purple-500 rounded-full"></div>
              </div>
            </div>
          </div>
        </Card>

        {/* Comparativa */}
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">Comparativa con el Mercado</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Percentil de exposición</span>
              <span className="font-semibold">Top 15%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">vs. Promedio de zona</span>
              <span className="font-semibold text-green-500">+28%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Precio vs. Mercado</span>
              <span className="font-semibold text-yellow-500">+5%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Tiempo en mercado</span>
              <span className="font-semibold">45 días</span>
            </div>
          </div>
        </Card>

        {/* Recomendaciones */}
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">Recomendaciones</h3>
          <div className="space-y-3">
            <div className="flex items-start space-x-2">
              <div className="p-1 bg-green-100 rounded">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-sm">Agregar más fotos del interior podría aumentar el engagement un 15%</p>
            </div>
            <div className="flex items-start space-x-2">
              <div className="p-1 bg-yellow-100 rounded">
                <BarChart3 className="h-4 w-4 text-yellow-600" />
              </div>
              <p className="text-sm">El precio está ligeramente por encima del mercado en la zona</p>
            </div>
            <div className="flex items-start space-x-2">
              <div className="p-1 bg-blue-100 rounded">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-sm">La mayoría de las visitas ocurren entre 18:00 y 20:00</p>
            </div>
            <div className="flex items-start space-x-2">
              <div className="p-1 bg-purple-100 rounded">
                <Clock className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-sm">Actualizar la descripción cada 2 semanas mejora la visibilidad</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PropertyStatsDashboard;