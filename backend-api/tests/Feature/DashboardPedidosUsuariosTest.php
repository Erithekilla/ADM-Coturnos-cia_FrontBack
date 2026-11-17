<?php

/**
 * Dashboard (só pedidos aprovados), edição de pedido pelo painel e exclusão de usuário.
 * Roda sobre o schema unificado (database/migrations).
 */

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

function dpu_usuario(string $role = 'customer'): User
{
    $u = new User([
        'first_name' => ucfirst($role),
        'last_name' => 'Teste',
        'email' => $role . '-' . Str::random(8) . '@teste.com',
        'password' => Hash::make('senha-forte-123'),
    ]);
    $u->forceFill(['role' => $role, 'active' => true])->save();

    return $u;
}

function dpu_token(User $u): string
{
    return $u->createToken('teste', $u->isAdmin() ? ['admin'] : ['cliente'])->plainTextToken;
}

function dpu_pedido(User $cliente, string $status, float $total, ?string $quando = null): int
{
    return DB::table('orders')->insertGetId([
        'order_number' => 'CC-' . strtoupper(Str::random(10)),
        'user_id' => $cliente->id,
        'status' => $status,
        'subtotal' => $total,
        'total_amount' => $total,
        'created_at' => $quando ?? now(),
        'updated_at' => $quando ?? now(),
    ]);
}

beforeEach(fn () => Cache::flush());

test('receita, pedidos e clientes contam só pedidos aprovados', function () {
    $admin = dpu_usuario('admin');
    $ana = dpu_usuario();
    $bia = dpu_usuario();

    dpu_pedido($ana, 'paid', 100);
    dpu_pedido($ana, 'delivered', 50);
    dpu_pedido($bia, 'pending', 30);    // não aprovado
    dpu_pedido($bia, 'cancelled', 20);  // não aprovado

    $res = $this->withToken(dpu_token($admin))->getJson('/api/v1/admin/dashboard')->assertOk();
    $metricas = collect($res->json('data.metrics'))->keyBy('id');

    expect($metricas['receita']['value'])->toBe('R$ 150,00')
        ->and($metricas['pedidos']['value'])->toBe('2')
        ->and($metricas['clientes']['value'])->toBe('1');

    $mes = (int) now()->month - 1;
    expect((float) $res->json("data.vendasMensais.$mes.vendas"))->toBe(150.0)
        ->and($res->json("data.vendasMensais.$mes.pedidos"))->toBe(2);
});

test('mudar o status de um pedido atualiza o dashboard na hora', function () {
    $admin = dpu_usuario('admin');
    $token = dpu_token($admin);
    $id = dpu_pedido(dpu_usuario(), 'pending', 80);

    $this->withToken($token)->getJson('/api/v1/admin/dashboard')->assertJsonPath('data.metrics.0.value', 'R$ 0,00');

    $this->withToken($token)
        ->putJson('/api/v1/pedidos/' . Order::encodeId($id), ['statusEnvio' => 'Processando'])
        ->assertOk();

    $this->withToken($token)->getJson('/api/v1/admin/dashboard')->assertJsonPath('data.metrics.0.value', 'R$ 80,00');
});

test('edição de pedido aceita os rótulos do painel e devolve o pedido formatado', function () {
    $token = dpu_token(dpu_usuario('admin'));
    $id = dpu_pedido(dpu_usuario(), 'paid', 99.9);
    $url = '/api/v1/pedidos/' . Order::encodeId($id);

    $this->withToken($token)->putJson($url, ['statusEnvio' => 'Processando'])
        ->assertOk()
        ->assertJsonPath('data.statusEnvio', 'Processando')
        ->assertJsonPath('data.statusCompra', 'Aprovado');
    expect(DB::table('orders')->where('id', $id)->value('status'))->toBe('preparing');

    // "Pendente" no envio não desfaz o pagamento
    $this->withToken($token)->putJson($url, ['statusEnvio' => 'Pendente'])->assertOk();
    expect(DB::table('orders')->where('id', $id)->value('status'))->toBe('paid');

    $this->withToken($token)->putJson($url, ['statusEnvio' => 'Qualquer'])->assertStatus(422);

    // histórico gravado em texto, com o autor
    expect(DB::table('order_history')->where('order_id', $id)->pluck('status')->all())->toBe(['preparing', 'paid']);
});

test('pedido cancelado não é reaberto e ID inexistente dá 404', function () {
    $token = dpu_token(dpu_usuario('admin'));
    $id = dpu_pedido(dpu_usuario(), 'cancelled', 10);

    $this->withToken($token)->putJson('/api/v1/pedidos/' . Order::encodeId($id), ['statusEnvio' => 'Enviado'])
        ->assertStatus(422);
    $this->withToken($token)->putJson('/api/v1/pedidos/' . Order::encodeId(999999), ['statusEnvio' => 'Enviado'])
        ->assertStatus(404);
    $this->withToken($token)->putJson('/api/v1/pedidos/' . $id, ['statusEnvio' => 'Enviado'])
        ->assertStatus(404); // inteiro cru
});

test('listagem de pedidos funciona no schema novo', function () {
    $token = dpu_token(dpu_usuario('admin'));
    $id = dpu_pedido(dpu_usuario(), 'shipped', 10);

    $this->withToken($token)->getJson('/api/v1/pedidos')
        ->assertOk()
        ->assertJsonPath('data.0.id', Order::encodeId($id))
        ->assertJsonPath('data.0.statusEnvio', 'Enviado');
});

test('excluir usuário pelo painel faz soft delete e respeita as proteções', function () {
    $admin = dpu_usuario('admin');
    $token = dpu_token($admin);
    $cliente = dpu_usuario();

    $this->withToken($token)->deleteJson('/api/v1/usuarios/' . $cliente->hashid)->assertOk();
    $this->assertSoftDeleted('users', ['id' => $cliente->id]);

    $ids = collect($this->withToken($token)->getJson('/api/v1/usuarios')->json('data'))->pluck('id');
    expect($ids)->not->toContain($cliente->hashid);

    // não pode excluir a si mesmo
    $this->withToken($token)->deleteJson('/api/v1/usuarios/' . $admin->hashid)->assertStatus(403);
});

test('trocar o tipo de usuário passa pelo serviço de privilégios', function () {
    $admin = dpu_usuario('admin');
    $token = dpu_token($admin);
    $cliente = dpu_usuario();

    $this->withToken($token)
        ->putJson('/api/v1/usuarios/' . $cliente->hashid, ['type' => 'Administrador', 'role' => 'admin'])
        ->assertOk();
    expect($cliente->fresh()->role)->toBe('admin');

    // o próprio admin não se despromove
    $this->withToken($token)
        ->putJson('/api/v1/usuarios/' . $admin->hashid, ['type' => 'Cliente', 'role' => 'cliente'])
        ->assertStatus(403);
});
