<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

/*
 * Servidor embutido do PHP (`php artisan serve`): como existe a pasta real
 * public/admin (build do painel), o PHP preenche SCRIPT_NAME com
 * /admin/index.html e o Laravel passa a tratar /admin como raiz do site.
 * Resultado: /admin/pedidos virava /pedidos e dava 404 ao recarregar a página.
 * Aqui o script de entrada volta a ser sempre /index.php. Não afeta Apache/Nginx.
 */
if (PHP_SAPI === 'cli-server') {
    $_SERVER['SCRIPT_NAME'] = '/index.php';
    $_SERVER['PHP_SELF'] = '/index.php';
    $_SERVER['SCRIPT_FILENAME'] = __FILE__;
}

if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

require __DIR__.'/../vendor/autoload.php';

$app = require_once __DIR__.'/../bootstrap/app.php';

$app->handleRequest(Request::capture());

