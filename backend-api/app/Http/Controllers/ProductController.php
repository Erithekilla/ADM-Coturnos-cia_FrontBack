<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\ProductSize;
use App\Models\ProductImage;
use App\Models\CartItem;
use App\Models\CollectionProduct;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // SoftDeletes já esconde os produtos excluídos
        $query = Product::with(['images', 'prices', 'sizes'])->orderBy('id', 'desc');

        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('model', 'like', "%{$search}%")
                  ->orWhere('product_type', 'like', "%{$search}%")
                  ->orWhere('brand', 'like', "%{$search}%");
            });
        }

        $products = $query->get();

        $formatted = $products->map(function ($p) {
            return $this->formatProduct($p);
        });

        return response()->json([
            'status' => 'success',
            'data' => $formatted,
            'total' => $formatted->count(),
        ], 200)->header('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'nullable|string|max:45',
            'modelo' => 'nullable|string|max:45',
            'model' => 'nullable|string|max:45',
            'productType' => 'nullable|string|max:45',
            'tipo_do_produto' => 'nullable|string|max:45',
            'product_type' => 'nullable|string|max:45',
            'brand' => 'nullable|string|max:45',
            'marca' => 'nullable|string|max:45',
            'price' => 'nullable|numeric|min:0',
            'preco' => 'nullable|numeric|min:0',
            'cost_price' => 'nullable|numeric|min:0',
            'costPrice' => 'nullable|numeric|min:0',
            'preco_custo' => 'nullable|numeric|min:0',
            'sizes' => 'nullable',
            'tamanhos' => 'nullable',
        ]);

        $model = $request->input('model') ?: $request->input('name') ?: $request->input('modelo');
        $type = $request->input('product_type') ?: $request->input('productType') ?: $request->input('tipo_do_produto') ?: 'Coturno';
        $brand = $request->input('brand') ?: $request->input('marca') ?: 'Coturnos & Cia';
        $description = $request->input('description') ?: $request->input('descricao') ?: '';
        $color = $request->input('color') ?: $request->input('cor') ?: 'Preto';
        $activeRaw = $request->input('active') ?: $request->input('ativo') ?: $request->input('status') ?: 'ativo';
        $active = strtolower((string) $activeRaw) !== 'inativo';
        $name = $request->input('name') ?: $model;

        if (empty($description)) {
            $description = "Calçado de alta resistência | Cor: {$color}";
        }

        $priceValue = (float) ($request->input('price') ?: $request->input('preco') ?: 0);
        $costPrice = (float) ($request->input('cost_price', $request->input('costPrice', $request->input('preco_custo', 0))));
        $totalStock = (int) ($request->input('stock') ?: $request->input('estoque') ?: 20);
        $imageUrl = $request->input('image') ?: $request->input('imagem') ?: '/coturno1.jpeg';

        $sizesReceived = $request->input('tamanhos_array') ?: $request->input('sizes') ?: $request->input('tamanhos') ?: [38, 39, 40, 41, 42, 43, 44];
        if (is_string($sizesReceived)) {
            $sizesReceived = array_map('intval', explode(',', str_replace(['[', ']', ' '], '', $sizesReceived)));
        }

        try {
            DB::beginTransaction();

            $product = Product::create([
                'name' => mb_substr($name ?: 'Novo Produto', 0, 120),
                'product_type' => mb_substr($type, 0, 45),
                'model' => mb_substr($model ?: ($name ?: 'Novo Produto'), 0, 45),
                'brand' => mb_substr($brand, 0, 45),
                'description' => mb_substr($description, 0, 2000),
                'color' => mb_substr($color ?: 'Preto', 0, 45),
                'base_price' => $priceValue, // preço vigente (o histórico fica em product_prices)
                'cost_price' => $costPrice,
                'active' => $active,
            ]);

            ProductPrice::create([
                'price' => $priceValue,
                'cost_price' => $costPrice,
                'effective_date' => now(),
                'product_id' => $product->id,
            ]);

            if (is_array($sizesReceived) && count($sizesReceived) > 0) {
                $qtyPerSize = max(1, (int) round($totalStock / count($sizesReceived)));
                foreach ($sizesReceived as $size) {
                    $sizeNum = (int) $size;
                    if ($sizeNum > 0) {
                        ProductSize::create([
                            'product_id' => $product->id,
                            'size' => $sizeNum,
                            'stock' => $qtyPerSize,
                        ]);
                    }
                }
            }

            if (!empty($imageUrl)) {
                ProductImage::create([
                    'image_url' => $imageUrl,
                    'product_id' => $product->id,
                ]);
            }

            DB::commit();

            $loadedProduct = Product::with(['images', 'prices', 'sizes'])->find($product->id);

            return response()->json([
                'status' => 'success',
                'message' => 'Product and sizes created successfully!',
                'data' => $this->formatProduct($loadedProduct),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Failed to save product in database.', $e);
        }
    }

    public function show($id): JsonResponse
    {
        $product = Product::findByHashid($id, ['images', 'prices', 'sizes']);

        if (!$product) {
            return response()->json([
                'status' => 'error',
                'message' => 'Product not found.'
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $this->formatProduct($product),
        ], 200);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $product = Product::findByHashid($id);

        if (!$product) {
            return response()->json([
                'status' => 'error',
                'message' => 'Product not found.'
            ], 404);
        }

        try {
            DB::beginTransaction();

            $model = $request->input('model') ?: $request->input('name') ?: $request->input('modelo') ?: $product->model;
            $type = $request->input('product_type') ?: $request->input('productType') ?: $request->input('tipo_do_produto') ?: $product->product_type;
            $brand = $request->input('brand') ?: $request->input('marca') ?: $product->brand;
            $description = $request->input('description') ?: $request->input('descricao') ?: $product->description;
            $color = $request->input('color') ?: $request->input('cor') ?: $product->color ?: 'Preto';

            $name = $request->input('name') ?: $product->name ?: $model;

            $active = (bool) $product->active;
            if ($request->has('active') || $request->has('ativo') || $request->has('status')) {
                $val = $request->input('active') ?: $request->input('ativo') ?: $request->input('status');
                $active = strtolower((string) $val) !== 'inativo';
            }

            $campos = [
                'name' => mb_substr($name, 0, 120),
                'product_type' => mb_substr($type, 0, 45),
                'model' => mb_substr($model, 0, 45),
                'brand' => mb_substr($brand, 0, 45),
                'description' => mb_substr((string) $description, 0, 2000),
                'color' => mb_substr($color, 0, 45),
                'active' => $active,
            ];

            if ($request->hasAny(['cost_price', 'costPrice', 'preco_custo'])) {
                $campos['cost_price'] = (float) $request->input('cost_price', $request->input('costPrice', $request->input('preco_custo', 0)));
            }

            if ($request->has('price') || $request->has('preco')) {
                $priceValue = (float) ($request->input('price') ?: $request->input('preco'));
                $campos['base_price'] = $priceValue;
                // só registra no histórico quando o preço muda de fato
                if ((float) $product->base_price !== $priceValue) {
                    ProductPrice::create([
                        'price' => $priceValue,
                        'cost_price' => $campos['cost_price'] ?? $product->cost_price,
                        'effective_date' => now(),
                        'product_id' => $product->id,
                    ]);
                }
            }

            $product->update($campos);

            if ($request->has('sizes') || $request->has('tamanhos') || $request->has('tamanhos_array')) {
                $sizesReceived = $request->input('tamanhos_array') ?: $request->input('sizes') ?: $request->input('tamanhos');
                if (is_string($sizesReceived)) {
                    $sizesReceived = array_map('intval', explode(',', str_replace(['[', ']', ' '], '', $sizesReceived)));
                }

                if (is_array($sizesReceived)) {
                    ProductSize::where('product_id', $product->id)->delete();
                    $totalStock = (int) ($request->input('stock') ?: $request->input('estoque') ?: 20);
                    $qtyPerSize = max(1, (int) round($totalStock / max(1, count($sizesReceived))));

                    foreach ($sizesReceived as $size) {
                        $sizeNum = (int) $size;
                        if ($sizeNum > 0) {
                            ProductSize::create([
                                'product_id' => $product->id,
                                'size' => $sizeNum,
                                'stock' => $qtyPerSize,
                            ]);
                        }
                    }
                }
            }

            if ($request->has('image') || $request->has('imagem')) {
                $imageUrl = $request->input('image') ?: $request->input('imagem');
                if (!empty($imageUrl)) {
                    ProductImage::where('product_id', $product->id)->delete();
                    ProductImage::create([
                        'image_url' => $imageUrl,
                        'product_id' => $product->id,
                    ]);
                }
            }

            DB::commit();

            $updatedProduct = Product::with(['images', 'prices', 'sizes'])->find($product->id);

            return response()->json([
                'status' => 'success',
                'message' => 'Product updated successfully!',
                'data' => $this->formatProduct($updatedProduct),
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Failed to update product.', $e);
        }
    }

    public function destroy($id): JsonResponse
    {
        $product = Product::findByHashid($id);

        if (!$product) {
            return response()->json([
                'status' => 'error',
                'message' => 'Product not found.'
            ], 404);
        }

        try {
            DB::beginTransaction();

            CartItem::where('product_id', $product->id)->delete();
            CollectionProduct::where('product_id', $product->id)->delete();

            $product->forceFill(['active' => false])->save();
            $product->delete(); // SoftDeletes: some da loja e do painel, pedidos antigos continuam

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Product removed successfully!',
                'data' => ['id' => $product->hashid]
            ], 200)->header('Cache-Control', 'no-cache, no-store, must-revalidate');
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Error deleting product.', $e);
        }
    }

    private function formatProduct(Product $p): array
    {
        $recentPrice = $p->prices->sortByDesc('effective_date')->first();
        $price = (float) $p->base_price ?: ($recentPrice ? (float) $recentPrice->price : 0);

        $sizesCollection = $p->sizes->sortBy('size');
        $sizesArray = $sizesCollection->pluck('size')->values()->toArray();
        $sizesText = count($sizesArray) > 0 ? implode(', ', $sizesArray) : '38-44';

        $stock = (int) $sizesCollection->sum('stock');
        $image = $p->images->first()->image_url ?? '/coturno1.jpeg';

        $color = $p->color ?: 'Preto';
        if ($color === 'Preto' && preg_match('/Cor:\s*([^|]+)/i', (string) $p->description, $matches)) {
            $color = trim($matches[1]);
        }

        $isAtivo = (bool) $p->active;
        $costPrice = (float) ($p->cost_price ?? 0);

        return [
            'id' => $p->hashid,
            'name' => $p->name ?: $p->model,
            'promotionalPrice' => $p->promotional_price !== null ? (float) $p->promotional_price : null,
            'productType' => $p->product_type,
            'product_type' => $p->product_type,
            'model' => $p->model,
            'brand' => $p->brand,
            'description' => $p->description,
            'active' => $isAtivo ? 'Ativo' : 'Inativo',
            'ativo' => $isAtivo ? 'ativo' : 'inativo',
            'status' => $isAtivo ? 'ativo' : 'inativo',
            'price' => $price,
            'cost_price' => $costPrice,
            'costPrice' => $costPrice,
            'preco_custo' => $costPrice,
            'stock' => $stock,
            'sizes' => $sizesText,
            'tamanhos_array' => $sizesArray,
            'color' => $color,
            'image' => $image,
        ];
    }
}

