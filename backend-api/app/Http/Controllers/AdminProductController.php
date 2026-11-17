<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\ProductSize;
use App\Models\ProductImage;
use App\Services\CloudinaryService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class AdminProductController extends Controller
{
    protected CloudinaryService $cloudinaryService;

    public function __construct(CloudinaryService $cloudinaryService)
    {
        $this->cloudinaryService = $cloudinaryService;
    }

    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'image' => 'required|file|image|max:10240',
        ]);

        $file = $request->file('image');
        $result = $this->cloudinaryService->upload($file, 'coturnos_produtos');

        return response()->json([
            'status' => 'success',
            'message' => 'Upload completed successfully!',
            'data' => $result
        ], 200);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'modelo' => 'nullable|string|max:45',
            'model' => 'nullable|string|max:45',
            'tipo_do_produto' => 'nullable|string|max:45',
            'product_type' => 'nullable|string|max:45',
            'marca' => 'nullable|string|max:45',
            'brand' => 'nullable|string|max:45',
            'preco' => 'nullable|numeric|min:0',
            'price' => 'nullable|numeric|min:0',
            'cost_price' => 'nullable|numeric|min:0',
            'costPrice' => 'nullable|numeric|min:0',
            'preco_custo' => 'nullable|numeric|min:0',
            'grade' => 'nullable|array',
            'tamanhos' => 'nullable',
            'sizes' => 'nullable',
            'image' => 'nullable',
        ]);

        try {
            DB::beginTransaction();

            $type = $request->input('product_type') ?: $request->input('productType') ?: $request->input('tipo_do_produto') ?: 'Coturno';
            $brand = $request->input('brand') ?: $request->input('marca') ?: 'Coturnos & Cia';
            $model = $request->input('model') ?: $request->input('modelo') ?: $request->input('name') ?: 'Novo Produto';
            $description = $request->input('description') ?: $request->input('descricao') ?: 'Calçado tático de alta performance';
            $color = $request->input('color') ?: $request->input('cor') ?: 'Preto';
            $price = (float) $request->input('price', $request->input('preco', 0));
            $costPrice = (float) $request->input('cost_price', $request->input('costPrice', $request->input('preco_custo', 0)));

            $product = Product::create([
                'product_type' => substr($type, 0, 45),
                'name' => mb_substr($request->input('name') ?: $model, 0, 120),
                'model' => mb_substr($model, 0, 45),
                'brand' => mb_substr($brand, 0, 45),
                'description' => mb_substr($description, 0, 2000),
                'color' => mb_substr($color, 0, 45),
                'base_price' => $price,
                'cost_price' => $costPrice,
                'active' => true,
            ]);

            ProductPrice::create([
                'price' => $price,
                'cost_price' => $costPrice,
                'effective_date' => now(),
                'product_id' => $product->id,
            ]);

            $grade = $request->input('grade');
            if (is_array($grade) && count($grade) > 0) {
                foreach ($grade as $item) {
                    $size = (int) ($item['size'] ?? $item['tamanho'] ?? 0);
                    $quantity = (int) ($item['stock'] ?? $item['quantidade'] ?? 0);
                    if ($size > 0) {
                        ProductSize::create([
                            'product_id' => $product->id,
                            'size' => $size,
                            'stock' => max(0, $quantity),
                        ]);
                    }
                }
            } else {
                $sizesList = $request->input('sizes') ?: $request->input('tamanhos') ?: [37, 38, 39, 40, 41, 42, 43, 44];
                if (is_string($sizesList)) {
                    $sizesList = array_map('intval', explode(',', str_replace(['[', ']', ' '], '', $sizesList)));
                }
                $totalStock = (int) ($request->input('stock') ?: $request->input('estoque') ?: 80);
                $qtyPerSize = max(1, (int) round($totalStock / max(1, count($sizesList))));

                foreach ($sizesList as $size) {
                    if ((int)$size > 0) {
                        ProductSize::create([
                            'product_id' => $product->id,
                            'size' => (int) $size,
                            'stock' => $qtyPerSize,
                        ]);
                    }
                }
            }

            $imageUrl = '/coturno1.jpeg';
            $publicId = null;

            if ($request->hasFile('image')) {
                $uploadRes = $this->cloudinaryService->upload($request->file('image'), 'coturnos_produtos');
                $imageUrl = $uploadRes['url'];
                $publicId = $uploadRes['public_id'] ?? null;
            } elseif ($request->filled('image')) {
                $imageUrl = $request->input('image');
                $publicId = $request->input('public_id');
            }

            ProductImage::create([
                'product_id' => $product->id,
                'image_url' => $imageUrl,
                'cloudinary_public_id' => $publicId,
            ]);

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Product created successfully!',
                'data' => Product::with(['images', 'prices', 'sizes'])->find($product->id)
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Error creating product.', $e);
        }
    }

    public function update(Request $request, $id): JsonResponse
    {
        $product = Product::findByHashid($id);
        if (!$product) {
            return response()->json(['status' => 'error', 'message' => 'Product not found.'], 404);
        }

        try {
            DB::beginTransaction();

            $novoModelo = $request->input('model', $request->input('modelo', $product->model));
            $product->update([
                'name' => mb_substr($request->input('name') ?: ($request->hasAny(['model', 'modelo']) ? $novoModelo : $product->name), 0, 120),
                'model' => mb_substr($novoModelo, 0, 45),
                'product_type' => substr($request->input('product_type', $request->input('tipo_do_produto', $product->product_type)), 0, 45),
                'brand' => substr($request->input('brand', $request->input('marca', $product->brand)), 0, 45),
                'description' => substr($request->input('description', $request->input('descricao', $product->description)), 0, 255),
                'color' => substr($request->input('color', $request->input('cor', $product->color)), 0, 45),
            ]);

            if ($request->hasAny(['cost_price', 'costPrice', 'preco_custo'])) {
                $novoCusto = (float) $request->input('cost_price', $request->input('costPrice', $request->input('preco_custo', 0)));
                $product->forceFill(['cost_price' => $novoCusto])->save();
            }

            if ($request->filled('price') || $request->filled('preco')) {
                $novoPreco = (float) ($request->input('price') ?: $request->input('preco'));
                ProductPrice::create([
                    'price' => $novoPreco,
                    'cost_price' => $product->cost_price,
                    'effective_date' => now(),
                    'product_id' => $product->id,
                ]);
                $product->forceFill(['base_price' => $novoPreco])->save();
            }

            if ($request->has('grade')) {
                ProductSize::where('product_id', $product->id)->delete();
                foreach ($request->input('grade', []) as $item) {
                    $size = (int) ($item['size'] ?? $item['tamanho'] ?? 0);
                    $quantity = (int) ($item['stock'] ?? $item['quantidade'] ?? 0);
                    if ($size > 0) {
                        ProductSize::create([
                            'product_id' => $product->id,
                            'size' => $size,
                            'stock' => max(0, $quantity),
                        ]);
                    }
                }
            }

            if ($request->hasFile('image')) {
                $uploadRes = $this->cloudinaryService->upload($request->file('image'), 'coturnos_produtos');
                ProductImage::where('product_id', $product->id)->delete();
                ProductImage::create([
                    'product_id' => $product->id,
                    'image_url' => $uploadRes['url'],
                    'cloudinary_public_id' => $uploadRes['public_id'] ?? null,
                ]);
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Product updated successfully!',
                'data' => Product::with(['images', 'prices', 'sizes'])->find($product->id)
            ], 200);

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Error updating product.', $e);
        }
    }

    public function destroy($id): JsonResponse
    {
        $product = Product::findByHashid($id);
        if (!$product) {
            return response()->json(['status' => 'error', 'message' => 'Product not found.'], 404);
        }

        try {
            DB::beginTransaction();

            $product->forceFill(['active' => false])->save();
            $product->delete();

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Product deactivated successfully (soft delete applied).'
            ], 200);

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Error removing product.', $e);
        }
    }
}

