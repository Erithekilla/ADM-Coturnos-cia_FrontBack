// src/components/organisms/LogEventsTable.tsx
import React, { useState, useEffect, ChangeEvent } from 'react';

export interface LogEvent {
  id: number;
  user: string;
  action: string;
  type: string;
  timestamp: string;
}

export const LogEventsTable: React.FC = () => {
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Estados dos Filtros
  const [filterUser, setFilterUser] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Estado para controle de paginação
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/v1/admin/logs');
        if (res.ok) {
          const json = await res.json();
          if (json.data && Array.isArray(json.data)) {
            setEvents(json.data);
          }
        }
      } catch (err) {
        console.error('Erro ao buscar logs do banco de dados:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  // Função de filtragem
  const handleEventSearch = events.filter((event) => {
    const matchesUser = event.user.toLowerCase().includes(filterUser.toLowerCase());
    const matchesType = filterType === '' || event.type === filterType;
    const eventDate = event.timestamp.split(' ')[0];
    const matchesStartDate = startDate === '' || eventDate >= startDate;
    const matchesEndDate = endDate === '' || eventDate <= endDate;
    
    return matchesUser && matchesType && matchesStartDate && matchesEndDate;
  });

  // Lógica de paginação aplicada sobre os resultados da filtragem
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentEvents = handleEventSearch.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(handleEventSearch.length / itemsPerPage);

  const getBadgeStyle = (type: string): string => {
    if (type.includes('LOGIN') || type.includes('LOGOUT')) return 'bg-amber-100 text-amber-800';
    if (type.includes('PRODUCT')) return 'bg-blue-100 text-blue-800';
    if (type.includes('ORDER')) return 'bg-emerald-100 text-emerald-800';
    return 'bg-purple-100 text-purple-800';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-900">Histórico de Auditoria (Banco de Dados)</h2>
        <p className="text-sm text-slate-500 mb-4">Registro automático de eventos gerados a partir do banco de dados MySQL.</p>

        {/* Bloco de Filtros Organizado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
          
          {/* Filtro por Login / Usuário */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Usuário</label>
            <input
              type="text"
              placeholder="Filtrar por nome..."
              value={filterUser}
              onChange={(e: ChangeEvent<HTMLInputElement>) => { setFilterUser(e.target.value); setCurrentPage(1); }}
              className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          {/* Filtro por Tipo de Evento (Ação) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Evento</label>
            <select
              value={filterType}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => { setFilterType(e.target.value); setCurrentPage(1); }}
              className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="">Todas as Ações</option>
              <option value="AUTH_LOGIN">Login</option>
              <option value="USER_ADD">Cadastro de Cliente</option>
              <option value="PRODUCT_ADD">Produto Catalogado</option>
              <option value="ORDER_STATUS">Atualização de Pedido</option>
            </select>
          </div>

          {/* Filtro de Data Inicial */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Data Inicial</label>
            <input
              type="date"
              value={startDate}
              onChange={(e: ChangeEvent<HTMLInputElement>) => { setStartDate(e.target.value); setCurrentPage(1); }}
              className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          {/* Filtro de Data Final */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Data Final</label>
            <input
              type="date"
              value={endDate}
              onChange={(e: ChangeEvent<HTMLInputElement>) => { setEndDate(e.target.value); setCurrentPage(1); }}
              className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
              <th className="py-3 px-6">Usuário</th>
              <th className="py-3 px-6">Ação Realizada</th>
              <th className="py-3 px-6">Categoria</th>
              <th className="py-3 px-6">Data e Hora</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {loading ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-500">
                  Carregando registros de auditoria do banco de dados...
                </td>
              </tr>
            ) : currentEvents.length > 0 ? (
              currentEvents.map((event) => (
                <tr key={event.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-6 font-medium text-slate-900">{event.user}</td>
                  <td className="py-4 px-6">{event.action}</td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${getBadgeStyle(event.type)}`}>
                      {event.type}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-slate-500">{event.timestamp}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-500">
                  Nenhum registro encontrado para os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Controles de Paginação */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50"
          >
            Anterior
          </button>
          <span className="text-sm text-slate-600">Página {currentPage} de {totalPages}</span>
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50"
          >
            Próximo
          </button>
        </div>
      )}
    </div>
  );
};

export default LogEventsTable;