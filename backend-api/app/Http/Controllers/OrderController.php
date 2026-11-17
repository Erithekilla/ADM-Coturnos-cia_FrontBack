<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\User;
use App\Models\Address;
use App\Models\ProductSize;
use App\Models\OrderHistory;
use App\Models\Product;
use App\Support\OrderStatus;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    /** Relações usadas pela listagem; inclui cliente/produto excluídos (o pedido continua existindo). */
    private function listRelations(): array
    {
        return [
            'user' => fn ($q) => $q->withTrashed(),
            'address', // Address não usa SoftDeletes no model
            'items.product' => fn ($q) => $q->withTrashed(),
            'payment',
        ];
    }

    public function index(): JsonResponse
    {
        $orders = Order::with($this->listRelations())->orderBy('id', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $orders->map(fn (Order $p) => $this->present($p))->values(),
        ], 200)->header('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    /** Formato que o painel consome (status em português, IDs cifrados). */
    private function present(Order $p): array
    {
        $data = $p->created_at ? $p->created_at->format('Y-m-d\TH:i:s') : null;
        $userId = $p->user_id ? User::encodeId((int) $p->user_id) : null;
        $addressId = $p->address_id ? Address::encodeId((int) $p->address_id) : null;

        return [
            'id' => $p->hashid,
            'orderNumber' => $p->order_number,
            'totalAmount' => (float) $p->total_amount,
            'valorTotal' => (float) $p->total_amount,
            'status' => $p->status,
            'statusEnvio' => OrderStatus::shippingLabel($p->status),
            'statusCompra' => OrderStatus::purchaseLabel($p->status, $p->payment?->status),
            'aprovado' => OrderStatus::isApproved($p->status),
            'trackingCode' => $p->tracking_code,
            'dataPedido' => $data,
            'orderDate' => $data,
            'usuarioId' => $userId,
            'userId' => $userId,
            'cliente' => $p->user ? trim($p->user->first_name . ' ' . $p->user->last_name) : 'Cliente removido',
            'enderecoId' => $addressId,
            'addressId' => $addressId,
            'produtos_do_pedido' => $p->items->map(function ($item) {
                $nome = $item->product_name ?: ($item->product?->name ?: ($item->product?->model ?: 'Calçado removido'));

                return [
                    'produto' => [
                        'id' => $item->product_id ? Product::encodeId((int) $item->product_id) : null,
                        'nome' => $nome,
                        'model' => $nome,
                        'categoria' => $item->product?->product_type ?: 'Coturno',
                        'preco' => (float) ($item->unit_price ?? 0),
                        'unitPrice' => (float) ($item->unit_price ?? 0),
                        'status' => 'Em Estoque',
                    ],
                    'tamanho' => $item->size,
                    'quantidade' => (int) ($item->quantity ?? 1),
                    'quantity' => (int) ($item->quantity ?? 1),
                    'precoUnitario' => (float) ($item->unit_price ?? 0),
                    'unitPrice' => (float) ($item->unit_price ?? 0),
                ];
            })->values(),
        ];
    }

    public function store(Request $request): JsonResponse
    {
        $this->decodeHashids($request, [
            'usuario_id' => User::class,
            'user_id' => User::class,
            'endereco_id' => Address::class,
            'address_id' => Address::class,
        ]);

        $userId = $request->input('user_id') ?: $request->input('usuario_id');
        $addressId = $request->input('address_id') ?: $request->input('endereco_id');
        $totalAmount = $request->input('total_amount') ?: $request->input('valor_total');
        $orderDate = $request->input('order_date') ?: $request->input('data_pedido') ?: now();
        $status = $request->input('status') ?: 'pendente';

        $request->merge([
            'user_id' => $userId,
            'address_id' => $addressId,
            'total_amount' => $totalAmount,
            'order_date' => $orderDate,
            'status' => $status,
        ]);

        $validated = $request->validate([
            'total_amount' => 'required|numeric',
            'status' => 'required|string|max:45',
            'order_date' => 'required|date',
            'user_id' => 'required|integer|exists:users,id',
            'address_id' => 'required|integer|exists:addresses,id',
        ]);

        $record = Order::create($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Order created successfully!',
            'data' => $record
        ], 201);
    }

    public function show($id): JsonResponse
    {
        $record = Order::findByHashid($id, ['user', 'address', 'items.product', 'payment', 'history']);

        if (!$record) {
            return response()->json([
                'status' => 'error',
                'message' => 'Order not found.'
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $record
        ], 200);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $record = Order::findByHashid($id, ['items']);

        if (!$record) {
            return response()->json([
                'status' => 'error',
                'code' => 'ORDER_NOT_FOUND',
                'message' => 'Pedido não encontrado.',
            ], 404);
        }

        $statusRecebido = $request->input('statusEnvio') ?? $request->input('status');
        $statusAnterior = $record->status;
        $novoStatus = $statusAnterior;

        if ($statusRecebido !== null && $statusRecebido !== '') {
            $novoStatus = OrderStatus::fromShippingLabel($statusRecebido, $statusAnterior);

            if ($novoStatus === null) {
                return response()->json([
                    'status' => 'error',
                    'message' => "Status inválido: '{$statusRecebido}'.",
                    'errors' => ['status' => ['Use Pendente, Processando, Enviado, Entregue ou Cancelado.']],
                ], 422);
            }

            // o estoque de um pedido cancelado já foi devolvido: reabrir duplicaria o estoque
            if ($statusAnterior === OrderStatus::CANCELLED && $novoStatus !== OrderStatus::CANCELLED) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Pedido cancelado não pode ser reaberto (o estoque já foi devolvido). Crie um novo pedido.',
                ], 422);
            }
        }

        try {
            DB::beginTransaction();

            if ($novoStatus !== $statusAnterior) {
                $record->status = $novoStatus;

                if ($novoStatus === OrderStatus::CANCELLED) {
                    foreach ($record->items as $item) {
                        $query = ProductSize::where('product_id', $item->product_id);
                        if (!empty($item->size)) {
                            $query->where('size', $item->size);
                        }
                        $query->increment('stock', (int) ($item->quantity ?: 1));
                    }
                }

                OrderHistory::create([
                    'order_id' => $record->id,
                    'status' => $novoStatus,
                    'status_date' => now(),
                    'notes' => "Status alterado de '{$statusAnterior}' para '{$novoStatus}'",
                    'changed_by' => $request->user()?->getKey(),
                ]);
            }

            $trackingCode = $request->input('tracking_code') ?: $request->input('codigo_rastreio');
            if ($trackingCode) {
                $record->tracking_code = mb_substr((string) $trackingCode, 0, 100);
            }

            if ($request->has('total_amount') || $request->has('valor_total') || $request->has('valorTotal')) {
                $record->total_amount = (float) ($request->input('total_amount') ?: $request->input('valor_total') ?: $request->input('valorTotal'));
            }

            $record->save();

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Pedido atualizado com sucesso!',
                'data' => $this->present($record->fresh($this->listRelations())),
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Erro ao atualizar o pedido.', $e);
        }
    }

    public function destroy($id): JsonResponse
    {
        $record = Order::findByHashid($id);

        if (!$record) {
            return response()->json([
                'status' => 'error',
                'message' => 'Order not found.'
            ], 404);
        }

        $record->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Order removed successfully!'
        ], 200);
    }
}

