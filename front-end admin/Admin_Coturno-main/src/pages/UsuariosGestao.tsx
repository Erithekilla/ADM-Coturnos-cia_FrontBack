import React, { useState, useEffect } from 'react';
import Sidebar from '../components/organisms/Sidebar';
import PageHeader_usuario from '../components/molecules/PageHeader_usuario';
import SearchInput from '../components/atoms/SearchInput';
import UserTable, { UserItem } from '../components/organisms/UserTable';

type FormMode = 'create' | 'edit' | null;

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export default function UsuariosGestao(): React.JSX.Element {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [formMode, setFormMode] = useState<FormMode>(null); 
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [formData, setFormData] = useState<UserItem>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    cpf: '',
    cep: '',
    sreet: '',
    sreet_number: '',
    block: '',
    city: '',
    state: '',
    type: 'Cliente',
    provider: 'Local',
    status: 'Ativo',
    createdAt: ''
  });

  const fetchUsers = async (): Promise<void> => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/usuarios?_t=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          Accept: 'application/json',
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          setUsers(json.data);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar usuários do banco MySQL:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const formatCep = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  };

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const isValidEmail = (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const handleEdit = (id: number | string): void => {
    const user = users.find(u => String(u.id) === String(id));
    if (user) {
      setFormData(user);
      setEditingId(id);
      setFormMode('edit');
    }
  };

  const handleDelete = async (id: number | string): Promise<void> => {
    if (!window.confirm('Tem certeza que deseja excluir este usuário do banco de dados?')) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/usuarios/${id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        setUsers(prev => prev.filter(u => String(u.id) !== String(id)));
        await fetchUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Erro ao excluir usuário no banco de dados.');
      }
    } catch (err) {
      console.error('Erro ao excluir usuário:', err);
      alert('Falha na comunicação com o servidor.');
    }
  };
  
  const handleNovoUsuario = (): void => {
    const today = new Date().toLocaleDateString('pt-BR');
    setFormData({ 
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      cpf: '',
      cep: '',
      sreet: '',
      sreet_number: '',
      block: '',
      city: '',
      state: '',
      type: 'Cliente',
      provider: 'Local',
      status: 'Ativo',
      createdAt: today
    });
    setFormMode('create');
  };
  
  const handleCloseForm = (): void => {
    setFormMode(null);
    setEditingId(null);
  };

  const filteredUsers = users.filter(user =>
    `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.cpf && user.cpf.includes(searchTerm))
  );

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    const payload = {
      nome: formData.firstName,
      firstName: formData.firstName,
      sobrenome: formData.lastName,
      lastName: formData.lastName,
      email: formData.email,
      cpf: formData.cpf,
      type: formData.type,
      role: formData.type?.toLowerCase() === 'administrador' ? 'admin' : 'cliente',
      provider: formData.provider || 'local',
      senha: 'password123',
    };

    try {
      const url = formMode === 'edit' && editingId !== null ? `/api/v1/usuarios/${editingId}` : '/api/v1/usuarios';
      const method = formMode === 'edit' ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchUsers();
        handleCloseForm();
      } else {
        const err = await res.json();
        alert(err.message || 'Erro ao salvar usuário no banco de dados.');
      }
    } catch (err) {
      console.error('Erro ao salvar usuário no banco:', err);
      alert('Falha na comunicação com o banco de dados.');
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800 antialiased overflow-x-hidden">
      <Sidebar activePage="usuarios" />

      <main className="flex-1 min-w-0 pl-72 pt-8 pb-10 pr-4 lg:pr-8 xl:pr-12 2xl:pr-16">
        <div className="max-w-[1600px] mx-auto space-y-6 min-w-0">
          
          <PageHeader_usuario 
            title="Gestão de Usuários" 
            subtitle="Gerencie os usuários e clientes cadastrados no banco de dados MySQL" 
            buttonText="Novo Usuário"
            onButtonClick={handleNovoUsuario}
            showButton={formMode === null}
            buttonClassName="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors px-4 py-2 text-sm flex items-center shadow-sm"
          />

          {formMode !== null ? (
            <div className="w-full bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-6">
              <h2 className="text-xl font-bold text-slate-900">
                {formMode === 'edit' ? 'Editar Usuário no Banco' : 'Cadastrar Usuário no Banco'}
              </h2>
              
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-slate-600">Nome</label>
                    <input type="text" className="p-2 border border-slate-200 rounded-lg text-sm" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} required />
                  </div>
                  <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-slate-600">Sobrenome</label>
                    <input type="text" className="p-2 border border-slate-200 rounded-lg text-sm" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} required />
                  </div>
                  <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-slate-600">E-mail</label>
                    <input
                      type="email"
                      className={`p-2 border rounded-lg text-sm ${formData.email && !isValidEmail(formData.email) ? 'border-red-400' : 'border-slate-200'}`}
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value.trim().toLowerCase() })}
                      placeholder="seuemail@exemplo.com"
                      required
                    />
                    {formData.email && !isValidEmail(formData.email) && (
                      <span className="text-xs text-red-500">Digite um e-mail válido</span>
                    )}
                  </div>
                  <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-slate-600">Telefone</label>
                    <input type="tel" className="p-2 border border-slate-200 rounded-lg text-sm" value={formData.phone || ''} onChange={(e) => setFormData({...formData, phone: formatPhone(e.target.value)})} placeholder="(11) 98765-4321" />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-slate-600">CPF</label>
                    <input type="text" className="p-2 border border-slate-200 rounded-lg text-sm" value={formData.cpf || ''} onChange={(e) => setFormData({...formData, cpf: formatCpf(e.target.value)})} placeholder="123.456.789-00" />
                  </div>
                  <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-slate-600">CEP</label>
                    <input type="text" className="p-2 border border-slate-200 rounded-lg text-sm" value={formData.cep || ''} onChange={(e) => setFormData({...formData, cep: formatCep(e.target.value)})} placeholder="12345-678" />
                  </div>
                  <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-slate-600">Tipo de Usuário</label>
                    <select className="p-2 border border-slate-200 rounded-lg bg-white text-sm" value={formData.type || 'Cliente'} onChange={(e) => setFormData({...formData, type: e.target.value})}>
                      <option value="Cliente">Cliente</option>
                      <option value="Administrador">Administrador</option>
                    </select>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-slate-600">Provedor</label>
                    <select className="p-2 border border-slate-200 rounded-lg bg-white text-sm" value={formData.provider || 'Local'} onChange={(e) => setFormData({...formData, provider: e.target.value})}>
                      <option value="Local">Local</option>
                      <option value="Google">Google</option>
                      <option value="Email/Senha">Email/Senha</option>
                    </select>
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm">
                    {formMode === 'edit' ? 'Atualizar no Banco' : 'Salvar no Banco'}
                  </button>
                  <button type="button" onClick={handleCloseForm} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition-colors text-sm">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              <div className="w-full bg-white rounded-xl mb-5 mt-7">
                <SearchInput value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar usuários no banco de dados..." />
              </div>
              
              {loading ? (
                <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-500">
                  Carregando usuários do banco de dados MySQL...
                </div>
              ) : (
                <UserTable 
                  users={filteredUsers as any} 
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