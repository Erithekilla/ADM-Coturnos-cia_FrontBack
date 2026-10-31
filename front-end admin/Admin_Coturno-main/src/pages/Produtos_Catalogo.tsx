import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import Sidebar from '../components/organisms/Sidebar';
import PageHeader from '../components/molecules/PageHeader';
import SearchInput from '../components/atoms/SearchInput';
import ProductTable, { Product } from '../components/organisms/ProductTable';

export interface ProductFormData {
  name: string;
  productType: string;
  model: string;
  brand: string;
  description: string;
  active: 'Ativo' | 'Inativo' | string;
  price: number | string;
  stock: number | string;
  sizes: string;
  color: string;
  image: string;
}

type FormMode = 'create' | 'edit' | null;

export default function Produtos_Catalogo(): React.JSX.Element {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [formMode, setFormMode] = useState<FormMode>(null); 
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [formData, setFormData] = useState<ProductFormData>({
    name: '', productType: '', model: '', brand: '', description: '', active: 'Ativo', price: '', stock: '', sizes: '', color: '', image: ''
  });

  const fetchProducts = async (): Promise<void> => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/produtos?_t=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          Accept: 'application/json',
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          setProducts(json.data);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar produtos do banco de dados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleEdit = (id: string | number): void => {
    const product = products.find(p => p.id === id);
    if (product) {
      setFormData({
        name: product.name,
        productType: product.productType,
        model: product.model,
        brand: product.brand,
        description: (product as any).description || '',
        active: product.active,
        price: product.price,
        stock: product.stock,
        sizes: product.sizes,
        color: product.color,
        image: (product as any).image || ''
      });
      setEditingId(Number(id));
      setFormMode('edit');
    }
  };

  const handleDelete = async (id: string | number): Promise<void> => {
    if (!window.confirm('Tem certeza que deseja excluir este produto do banco de dados?')) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/produtos/${id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        setProducts(prev => prev.filter(p => String(p.id) !== String(id)));
        await fetchProducts();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Erro ao excluir produto no banco de dados.');
      }
    } catch (err) {
      console.error('Erro ao excluir produto no banco de dados:', err);
      alert('Falha na comunicação com o servidor.');
    }
  };
  
  const handleOpenCreate = (): void => {
    setFormData({ name: '', productType: '', model: '', brand: '', description: '', active: 'Ativo', price: '', stock: '', sizes: '', color: '', image: '' });
    setFormMode('create');
  };
  
  const handleCloseForm = (): void => {
    setFormMode(null);
    setEditingId(null);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, image: `/${file.name}` });
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.productType && product.productType.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (product.brand && product.brand.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleFormSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const parsedPrice = typeof formData.price === 'number' ? formData.price : parseFloat(formData.price) || 0;
    const parsedStock = typeof formData.stock === 'number' ? formData.stock : parseInt(formData.stock, 10) || 0;

    const payload = {
      name: formData.name,
      modelo: formData.model || formData.name,
      productType: formData.productType,
      tipo_do_produto: formData.productType,
      brand: formData.brand,
      marca: formData.brand,
      description: formData.description,
      descricao: formData.description,
      active: formData.active,
      price: parsedPrice,
      preco: parsedPrice,
      stock: parsedStock,
      estoque: parsedStock,
      sizes: formData.sizes,
      color: formData.color,
      image: formData.image,
    };

    try {
      const url = formMode === 'edit' && editingId !== null ? `/api/v1/produtos/${editingId}` : '/api/v1/produtos';
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
        await fetchProducts();
        handleCloseForm();
      } else {
        const err = await res.json();
        alert(err.message || 'Erro ao salvar produto no banco de dados.');
      }
    } catch (err) {
      console.error('Erro ao salvar no banco de dados:', err);
      alert('Falha na comunicação com o banco de dados.');
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 overflow-x-hidden">
      <Sidebar activePage="produtos" />
      <main className="flex-1 min-w-0 pl-72 pt-8 pb-10 pr-4 lg:pr-8 xl:pr-12 2xl:pr-16">
        <div className="max-w-[1600px] mx-auto space-y-6 min-w-0">
          <PageHeader 
            title="Gerenciamento de Produtos" 
            subtitle="Gerencie o catálogo de calçados diretamente no banco de dados" 
            onActionClick={handleOpenCreate} 
            hideButton={formMode !== null}
            buttonClassName="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors px-4 py-2 text-sm flex items-center shadow-sm"
          />

          {formMode !== null ? (
            <div className="w-full bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-6">
              <h2 className="text-xl font-bold text-slate-900">
                {formMode === 'edit' ? 'Editar Produto no Banco' : 'Cadastrar Novo Produto no Banco'}
              </h2>
              
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-slate-600">Nome do Produto</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: Coturno Tático"
                      className="border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>

                  <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-slate-600">Tipo de Produto</label>
                    <select 
                      className="border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500"
                      value={formData.productType}
                      onChange={(e) => setFormData({...formData, productType: e.target.value})}
                    >
                      <option value="">Selecione um tipo</option>
                      <option value="Coturno">Coturno</option>
                      <option value="Borzeguim">Borzeguim</option>
                      <option value="Sapato Social">Sapato Social</option>
                      <option value="Acessório">Acessório</option>
                    </select>
                  </div>

                  <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-slate-600">Modelo</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Combat Pro"
                      className="border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500"
                      value={formData.model}
                      onChange={(e) => setFormData({...formData, model: e.target.value})}
                    />
                  </div>

                  <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-slate-600">Marca</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Atalaia"
                      className="border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500"
                      value={formData.brand}
                      onChange={(e) => setFormData({...formData, brand: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-sm font-medium text-slate-600">Descrição do Produto</label>
                  <textarea 
                    rows={3}
                    placeholder="Adicione detalhes sobre material, solado e resistência..."
                    className="border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-slate-600">Preço (R$)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      required
                      placeholder="0,00"
                      className="border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500"
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                    />
                  </div>

                  <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-slate-600">Estoque</label>
                    <input 
                      type="number" 
                      required
                      placeholder="Quantidade"
                      className="border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500"
                      value={formData.stock}
                      onChange={(e) => setFormData({...formData, stock: e.target.value})}
                    />
                  </div>

                  <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-slate-600">Tamanhos Disponíveis</label>
                    <input 
                      type="text" 
                      placeholder="Ex: 38-44 ou 38, 39, 40"
                      className="border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500"
                      value={formData.sizes}
                      onChange={(e) => setFormData({...formData, sizes: e.target.value})}
                    />
                  </div>

                  <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-slate-600">Cor</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Preto, Marrom, Bege"
                      className="border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500"
                      value={formData.color}
                      onChange={(e) => setFormData({...formData, color: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-sm font-medium text-slate-600">Status</label>
                  <div className="flex space-x-2">
                    <button 
                      type="button" 
                      onClick={() => setFormData({...formData, active: 'Ativo'})}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors border ${formData.active === 'Ativo' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-white text-slate-600 border-slate-300'}`}
                    >
                      Ativo
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setFormData({...formData, active: 'Inativo'})}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors border ${formData.active === 'Inativo' ? 'bg-rose-50 text-rose-700 border-rose-300' : 'bg-white text-slate-600 border-slate-300'}`}
                    >
                      Inativo
                    </button>
                  </div>
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-sm font-medium text-slate-600">Imagem do Produto</label>
                  <div className="flex items-center space-x-3">
                    <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium px-4 py-2 rounded-lg transition-colors text-sm flex items-center justify-center">
                      <span>Anexar Imagem</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleFileChange} 
                      />
                    </label>
                    <span className="text-sm text-slate-500 truncate max-w-xs">
                      {formData.image ? formData.image : 'Nenhum arquivo escolhido'}
                    </span>
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button 
                    type="submit" 
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    {formMode === 'edit' ? 'Salvar no Banco' : 'Cadastrar no Banco'}
                  </button>
                  <button 
                    type="button" 
                    onClick={handleCloseForm} 
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition-colors"
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
                  placeholder="Buscar produtos no banco de dados..." 
                />
              </div>

              {loading ? (
                <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-500">
                  Carregando produtos do banco de dados MySQL...
                </div>
              ) : (
                <ProductTable 
                  products={filteredProducts} 
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