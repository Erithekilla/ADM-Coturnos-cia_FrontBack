<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('products') && !Schema::hasColumn('products', 'cost_price')) {
            Schema::table('products', function (Blueprint $table) {
                $table->decimal('cost_price', 10, 2)->nullable()->default(0.00)->after('base_price');
            });
        }

        if (Schema::hasTable('product_prices') && !Schema::hasColumn('product_prices', 'cost_price')) {
            Schema::table('product_prices', function (Blueprint $table) {
                $table->decimal('cost_price', 10, 2)->nullable()->default(null)->after('price');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('products') && Schema::hasColumn('products', 'cost_price')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropColumn('cost_price');
            });
        }

        if (Schema::hasTable('product_prices') && Schema::hasColumn('product_prices', 'cost_price')) {
            Schema::table('product_prices', function (Blueprint $table) {
                $table->dropColumn('cost_price');
            });
        }
    }
};
