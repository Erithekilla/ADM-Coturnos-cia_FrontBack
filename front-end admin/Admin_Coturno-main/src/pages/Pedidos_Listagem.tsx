// src/pages/Pedidos_Listagem.tsx
import React, { useState, useEffect, FormEvent } from 'react';
import Sidebar from '../components/organisms/Sidebar';
import PageHeader from '../components/molecules/PageHeader';
import SearchInput from '../components/atoms/SearchInput';
import PedidoTable from '../components/organisms/PedidoTable';
import { Pedido, PedidoEnvioStatus, PedidoCompraStatus } from '../types/order';

export interface PedidoFormData extends Omit<Pedido, 'valorTotal'> {
  valorTotal: number | string;
}

export default function Pedidos_Listagem(): React.JSX.Element {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [formData, setFormData] = useState<PedidoFormData>({
    id: '',
    valorTotal: '',
    statusCompra: 'Pendente',
    statusEnvio: 'Pendente',
    dataPedido: '',
    usuarioId: '',
    enderecoId: '',
    produtos_do_pedido: [],
  });

  const fetchPedidos = async (): Promise<void> => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/pedidos');
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          setPedidos(json.data);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar pedidos do banco de dados MySQL:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPedidos();
  }, []);

  const handleEdit = (id: string | number): void => {
    const pedido = pedidos.find((p) => String(p.id) === String(id));
    if (pedido) {
      setFormData({
        id: pedido.id,
        valorTotal: pedido.valorTotal,
        statusCompra: pedido.statusCompra,
        statusEnvio: pedido.statusEnvio,
        dataPedido: pedido.dataPedido,
        usuarioId: pedido.usuarioId,
        enderecoId: pedido.enderecoId,
        produtos_do_pedido: pedido.produtos_do_pedido || [],
      });
      setEditingId(pedido.id);
      setIsEditing(true);
    }
  };

  const handleCloseForm = (): void => {
    setIsEditing(false);
    setEditingId(null);
  };

  const handleFormSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (editingId !== null) {
      try {
        const res = await fetch(`/api/v1/pedidos/${editingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            status: formData.statusEnvio,
            statusEnvio: formData.statusEnvio,
          }),
        });

        if (res.ok) {
          await fetchPedidos();
          handleCloseForm();
        } else {
          const err = await res.json();
          alert(err.message || 'Erro ao atualizar pedido no banco de dados.');
        }
      } catch (err) {
        console.error('Erro ao atualizar pedido:', err);
        alert('Falha na comunicação com o banco de dados.');
      }
    }
  };

  const handleDelete = async (id: string | number): Promise<void> => {
    if (!window.confirm('Deseja realmente cancelar este pedido no banco de dados?')) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/pedidos/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          status: 'Cancelado',
          statusEnvio: 'Cancelado',
        }),
      });

      if (res.ok) {
        await fetchPedidos();
      } else {
        const err = await res.json();
        alert(err.message || 'Erro ao cancelar pedido.');
      }
    } catch (err) {
      console.error('Erro ao cancelar pedido:', err);
      alert('Falha na comunicação com o banco de dados.');
    }
  };

  const filteredPedidos = pedidos.filter((pedido) => {
    const term = searchTerm.toLowerCase();
    return (
      String(pedido.id).toLowerCase().includes(term) ||
      (pedido.statusEnvio && pedido.statusEnvio.toLowerCase().includes(term)) ||
      (pedido.statusCompra && pedido.statusCompra.toLowerCase().includes(term)) ||
      String(pedido.usuarioId).toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex min-h-screen bg-slate-50 overflow-x-hidden">
      <Sidebar activePage="pedidos" />
      <main className="flex-1 min-w-0 pl-72 pt-8 pb-10 pr-4 lg:pr-8 xl:pr-12 2xl:pr-16">
        <div className="max-w-[1600px] mx-auto space-y-6 min-w-0">
          <PageHeader
            title="Listagem de Pedidos"
            subtitle="Acompanhe os pedidos reais cadastrados no banco de dados MySQL"
            hideButton={true}
          />

          {isEditing ? (
            <div className="w-full bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-6">
              <h2 className="text-xl font-bold text-slate-900">
                Detalhes do Pedido #{formData.id}
              </h2>

              <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {/* ID do Pedido */}
                  <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-slate-600">
                      ID do Pedido
                    </label>
                    <input
                      type="text"
                      disabled
                      value={formData.id}
                      className="p-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed focus:outline-none text-sm"
                    />
                  </div>

                  {/* Valor Total */}
                  <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-slate-600">
                      Valor Total
                    </label>
                    <input
                      type="text"
                      disabled
                      value={Number(formData.valorTotal || 0).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                      className="p-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed focus:outline-none text-sm"
                    />
                  </div>

                  {/* Status do Envio */}
                  <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-slate-600">
                      Status de Envio (MySQL)
                    </label>
                    <select
                      value={formData.statusEnvio}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          statusEnvio: e.target.value as PedidoEnvioStatus,
                        })
                      }
                      className="p-2 border border-slate-200 rounded-lg bg-white text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="Pendente">Pendente</option>
                      <option value="Processando">Processando</option>
                      <option value="Enviado">Enviado</option>
                      <option value="Entregue">Entregue</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
                  </div>

                  {/* Data do Pedido */}
                  <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-slate-600">
                      Data do Pedido
                    </label>
                    <input
                      type="text"
                      disabled
                      value={
                        formData.dataPedido
                          ? new Date(formData.dataPedido).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''
                      }
                      className="p-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed focus:outline-none text-sm"
                    />
                  </div>
                </div>

                <div className="flex space-x-3 pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
                  >
                    Salvar Alterações no Banco
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseForm}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              <div className="w-full bg-white rounded-xl mb-5 mt-7">
                <SearchInput
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar pedidos no banco de dados..."
                />
              </div>

              {loading ? (
                <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-500">
                  Carregando pedidos do banco de dados MySQL...
                </div>
              ) : (
                <PedidoTable
                  pedidos={filteredPedidos}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}