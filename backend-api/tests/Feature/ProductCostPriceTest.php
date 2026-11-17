<?php

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function criarAdminParaProduto(): array
{
    $admin = new User([
        'first_name' => 'Admin',
        'last_name' => 'Produto',
        'email' => 'admin_prod_' . uniqid() . '@teste.com',
        'password' => 'secret123',
    ]);
    $admin->role = 'admin';
    $admin->active = true;
    $admin->save();

    $token = $admin->createToken('admin-test')->plainTextToken;

    return [$admin, $token];
}

test('pode criar produto com preco de custo (cost_price)', function () {
    [$admin, $token] = criarAdminParaProduto();

    $response = $this->withToken($token)->postJson('/api/v1/produtos', [
        'name' => 'Coturno Tático T1',
        'productType' => 'Coturno',
        'brand' => 'Coturnos & Cia',
        'price' => 299.90,
        'cost_price' => 149.50,
        'stock' => 50,
        'sizes' => '39, 40, 41, 42',
        'color' => 'Preto',
    ]);

    $response->assertCreated();
    $data = $response->json('data');

    expect((float) $data['cost_price'])->toBe(149.50)
        ->and((float) $data['costPrice'])->toBe(149.50)
        ->and((float) $data['price'])->toBe(299.90);

    $produto = Product::findByHashid($data['id']);
    expect($produto)->not->toBeNull()
        ->and((float) $produto->cost_price)->toBe(149.50);
});

test('pode atualizar preco de custo de um produto existente', function () {
    [$admin, $token] = criarAdminParaProduto();

    $produto = Product::create([
        'name' => 'Coturno Resgate R2',
        'product_type' => 'Coturno',
        'brand' => 'Coturnos & Cia',
        'base_price' => 350.00,
        'cost_price' => 180.00,
        'active' => true,
    ]);

    $response = $this->withToken($token)->putJson('/api/v1/produtos/' . $produto->hashid, [
        'cost_price' => 195.50,
    ]);

    $response->assertOk();
    $data = $response->json('data');

    expect((float) $data['cost_price'])->toBe(195.50);

    $produto->refresh();
    expect((float) $produto->cost_price)->toBe(195.50);
});

test('listagem de produtos retorna cost_price formatado', function () {
    [$admin, $token] = criarAdminParaProduto();

    $produto = Product::create([
        'name' => 'Coturno Militar M3',
        'product_type' => 'Coturno',
        'brand' => 'Coturnos & Cia',
        'base_price' => 400.00,
        'cost_price' => 210.00,
        'active' => true,
    ]);

    $response = $this->withToken($token)->getJson('/api/v1/produtos');
    $response->assertOk();

    $item = collect($response->json('data'))->firstWhere('id', $produto->hashid);
    expect($item)->not->toBeNull()
        ->and((float) $item['cost_price'])->toBe(210.00);
});

test('admin pode criar e atualizar produto com preco de custo via rota admin', function () {
    [$admin, $token] = criarAdminParaProduto();

    $createRes = $this->withToken($token)->postJson('/api/v1/admin/produtos', [
        'name' => 'Coturno Força Especial',
        'model' => 'FE-01',
        'brand' => 'Atalaia',
        'price' => 450.00,
        'cost_price' => 220.00,
        'stock' => 20,
    ]);

    $createRes->assertCreated();
    $prodId = $createRes->json('data.id');
    $produto = Product::findByHashid($prodId);
    expect($produto)->not->toBeNull()
        ->and((float) $produto->cost_price)->toBe(220.00);

    $updateRes = $this->withToken($token)->putJson('/api/v1/admin/produtos/' . $produto->hashid, [
        'cost_price' => 240.00,
    ]);

    $updateRes->assertOk();
    $produto->refresh();
    expect((float) $produto->cost_price)->toBe(240.00);
});
