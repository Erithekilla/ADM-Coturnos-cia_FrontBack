<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Product;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ProductSize;
use App\Models\ProductPrice;
use App\Models\AuditLog;
use App\Support\Hashid;
use App\Support\OrderStatus;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class AdminDashboardController extends Controller
{
    /** Chave do cache das métricas; o OrderObserver limpa quando um pedido muda. */
    public const CACHE_KEY = 'metrics_dashboard';

    /**
     * GET /api/v1/admin/dashboard
     *
     * Todas as métricas de venda usam SOMENTE pedidos aprovados
     * (OrderStatus::APPROVED = paid, preparing, shipped, delivered).
     * Pendentes e cancelados não entram em receita, contagem de pedidos,
     * vendas mensais, top produtos nem clientes.
     */
    public function dashboard(): JsonResponse
    {
        $dados = Cache::remember(self::CACHE_KEY, 60, function () {
            $aprovados = fn () => Order::query()->whereIn('status', OrderStatus::APPROVED);

            $inicioMes = now()->startOfMonth();
            $fimMes = now()->endOfMonth();
            $inicioMesAnterior = now()->subMonthNoOverflow()->startOfMonth();
            $fimMesAnterior = now()->subMonthNoOverflow()->endOfMonth();

            // 1. Receita (total dos pedidos aprovados) e comparação com o mês anterior
            $receitaTotal = (float) $aprovados()->sum('total_amount');
            $receitaMesAtual = (float) $aprovados()->whereBetween('created_at', [$inicioMes, $fimMes])->sum('total_amount');
            $receitaMesAnterior = (float) $aprovados()->whereBetween('created_at', [$inicioMesAnterior, $fimMesAnterior])->sum('total_amount');

            // 2. Pedidos aprovados e comparação com o mês anterior
            $totalPedidos = $aprovados()->count();
            $pedidosMesAtual = $aprovados()->whereBetween('created_at', [$inicioMes, $fimMes])->count();
            $pedidosMesAnterior = $aprovados()->whereBetween('created_at', [$inicioMesAnterior, $fimMesAnterior])->count();

            // 3. Clientes que têm ao menos um pedido aprovado
            $totalClientes = $aprovados()->distinct()->count('user_id');
            $clientesMesAtual = $aprovados()->whereBetween('created_at', [$inicioMes, $fimMes])->distinct()->count('user_id');
            $clientesMesAnterior = $aprovados()->whereBetween('created_at', [$inicioMesAnterior, $fimMesAnterior])->distinct()->count('user_id');

            // 4. Estoque (não depende de pedido): unidades de produtos não excluídos
            $totalEstoque = (int) DB::table('product_sizes')
                ->join('products', 'products.id', '=', 'product_sizes.product_id')
                ->whereNull('products.deleted_at')
                ->sum('product_sizes.stock');

            $estoqueCriticoItens = ProductSize::with('product')
                ->where('stock', '<', 5)
                ->whereHas('product') // SoftDeletes já ignora os excluídos
                ->get()
                ->map(fn ($t) => [
                    'produtoId' => Product::encodeId((int) $t->product_id),
                    'nome' => $t->product?->name ?: ($t->product?->model ?: 'Coturno sem nome'),
                    'tamanho' => $t->size,
                    'quantidade' => (int) $t->stock,
                ])
                ->values();

            // 5. Vendas mensais do ano corrente (somente aprovados)
            $mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            $porMes = array_fill(1, 12, ['vendas' => 0.0, 'pedidos' => 0]);

            $aprovados()
                ->whereBetween('created_at', [now()->startOfYear(), now()->endOfYear()])
                ->get(['created_at', 'total_amount'])
                ->each(function ($o) use (&$porMes) {
                    $m = (int) $o->created_at->month;
                    $porMes[$m]['vendas'] += (float) $o->total_amount;
                    $porMes[$m]['pedidos']++;
                });

            $vendasMensais = [];
            foreach ($porMes as $m => $v) {
                $vendasMensais[] = [
                    'mes' => $mesesNomes[$m - 1],
                    'vendas' => round($v['vendas'], 2),
                    'pedidos' => $v['pedidos'],
                ];
            }

            // 6. Pedidos por status (distribuição de todos os pedidos, para acompanhamento)
            $contagem = Order::query()->select('status', DB::raw('COUNT(*) as total'))
                ->groupBy('status')
                ->pluck('total', 'status')
                ->toArray();
            $pedidosPorStatus = [];
            foreach (OrderStatus::ALL as $st) {
                $pedidosPorStatus[$st] = (int) ($contagem[$st] ?? 0);
            }

            // 7. Produtos por categoria (composição do catálogo, não depende de venda)
            $cores = ['#142952', '#000000', '#4a5c3a', '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
            $textClasses = ['text-azul', 'text-preto', 'text-army', 'text-blue-500', 'text-rose-500', 'text-emerald-500', 'text-amber-500', 'text-purple-500'];

            $produtosPorTipo = Product::query()
                ->select('product_type', DB::raw('COUNT(*) as total'))
                ->groupBy('product_type')
                ->get();
            $totalProdutos = (int) $produtosPorTipo->sum('total');

            $categorias = [];
            foreach ($produtosPorTipo->values() as $i => $tipoItem) {
                $qtd = (int) $tipoItem->total;
                $categorias[] = [
                    'nome' => ucwords(str_replace('-', ' ', $tipoItem->product_type ?? 'Geral')),
                    'quantidade' => $qtd,
                    'porcentagem' => $totalProdutos > 0 ? (int) round(($qtd / $totalProdutos) * 100) : 0,
                    'cor' => $cores[$i % count($cores)],
                    'classesTexto' => $textClasses[$i % count($textClasses)],
                ];
            }

            // 8. Top 5 produtos mais vendidos em pedidos aprovados (vendas e receita reais)
            $topVendas = DB::table('order_items')
                ->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->whereIn('orders.status', OrderStatus::APPROVED)
                ->groupBy('order_items.product_id')
                ->selectRaw('order_items.product_id, SUM(order_items.quantity) as vendas, SUM(order_items.subtotal) as receita, MAX(order_items.product_name) as nome_na_venda')
                ->orderByDesc('vendas')
                ->limit(5)
                ->get();

            // inclui produtos já excluídos: a venda aconteceu
            $produtos = Product::withTrashed()->with('images')
                ->whereIn('id', $topVendas->pluck('product_id'))
                ->get()
                ->keyBy('id');

            $topProdutos = $topVendas->map(function ($row) use ($produtos) {
                $prod = $produtos->get($row->product_id);
                $foto = $prod?->images->first()->image_url ?? '/coturno1.jpeg';

                return [
                    'id' => Product::encodeId((int) $row->product_id),
                    'name' => $prod?->name ?: ($row->nome_na_venda ?: ($prod?->model ?: 'Coturno sem nome')),
                    'sales' => (int) $row->vendas,
                    'revenue' => 'R$ ' . number_format((float) $row->receita, 2, ',', '.'),
                    'rating' => 4.8,
                    'foto' => $foto,
                    'image' => $foto,
                ];
            })->values();

            return [
                'metrics' => [
                    [
                        'id' => 'receita',
                        'label' => 'Receita (Pedidos Aprovados)',
                        'value' => 'R$ ' . number_format($receitaTotal, 2, ',', '.'),
                        'trend' => $this->variacao($receitaMesAtual, $receitaMesAnterior),
                        'bgColor' => 'bg-army',
                    ],
                    [
                        'id' => 'pedidos',
                        'label' => 'Pedidos Aprovados',
                        'value' => number_format($totalPedidos, 0, ',', '.'),
                        'trend' => $this->variacao($pedidosMesAtual, $pedidosMesAnterior),
                        'bgColor' => 'bg-marrom',
                    ],
                    [
                        'id' => 'estoque',
                        'label' => 'Produtos em Estoque',
                        'value' => number_format($totalEstoque, 0, ',', '.'),
                        'trend' => 0.0,
                        'bgColor' => 'bg-azul',
                    ],
                    [
                        'id' => 'clientes',
                        'label' => 'Clientes com Compra Aprovada',
                        'value' => number_format($totalClientes, 0, ',', '.'),
                        'trend' => $this->variacao($clientesMesAtual, $clientesMesAnterior),
                        'bgColor' => 'bg-preto',
                    ],
                ],
                'faturamentoComparativo' => [
                    'mesAtual' => $receitaMesAtual,
                    'mesAnterior' => $receitaMesAnterior,
                    'variacaoPercentual' => $this->variacao($receitaMesAtual, $receitaMesAnterior),
                ],
                'pedidosPorStatus' => $pedidosPorStatus,
                'estoqueCritico' => [
                    'totalCriticos' => $estoqueCriticoItens->count(),
                    'itens' => $estoqueCriticoItens,
                ],
                'vendasMensais' => $vendasMensais,
                'categorias' => $categorias,
                'topProdutos' => $topProdutos,
            ];
        });

        return response()->json([
            'status' => 'success',
            'data' => $dados,
        ], 200);
    }

    /** Variação percentual mês atual x mês anterior. */
    private function variacao(float $atual, float $anterior): float
    {
        if ($anterior > 0) {
            return round((($atual - $anterior) / $anterior) * 100, 1);
        }

        return $atual > 0 ? 100.0 : 0.0;
    }

    /**
     * GET /api/v1/admin/logs: Registros de auditoria (tabela audit_logs).
     */
    public function logs(): JsonResponse
    {
        $auditLogs = AuditLog::orderBy('id', 'desc')->take(50)->get();

        $formatted = $auditLogs->map(function ($log) {
            // IDs sempre cifrados, inclusive dentro dos textos exibidos no painel
            $adminRef = $log->admin_user_id ? User::encodeId((int) $log->admin_user_id) : null;
            $legacyRef = ($log->registro_id && $log->tabela) ? Hashid::encode((int) $log->registro_id, (string) $log->tabela) : null;

            return [
                'id' => $log->hashid,
                // schema novo: actor_label/description; colunas antigas ficam como fallback
                'user' => $log->actor_label ?: ($log->autor ?: ($adminRef ? "Admin {$adminRef}" : 'Sistema')),
                'action' => $log->description ?: ($log->detalhes ?: ($log->action ? "{$log->action} em {$log->table_affected} (" . ($log->record_hashid ?? '-') . ')' : "Ação em {$log->tabela} (" . ($legacyRef ?? '-') . ')')),
                'type' => $log->action ?: ($log->acao ?: 'AUDIT'),
                'timestamp' => $log->created_at ? $log->created_at->format('Y-m-d H:i:s') : date('Y-m-d H:i:s'),
            ];
        });

        return response()->json([
            'status' => 'success',
            'data' => $formatted
        ], 200);
    }
}
