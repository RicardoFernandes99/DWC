<?php

/*
 * Router for `php artisan serve` (local Docker only).
 *
 * Same as the framework's default, except that static files get long-lived
 * cache headers. Asset URLs carry a ?v=<mtime> version (see the layout), so a
 * changed file is fetched again while unchanged ones are never re-downloaded.
 */

$publicPath = getcwd();

$uri = urldecode(
    parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? ''
);

if ($uri !== '/' && file_exists($publicPath.$uri)) {
    $file = $publicPath.$uri;
    $types = [
        'css' => 'text/css; charset=utf-8',
        'js' => 'text/javascript; charset=utf-8',
        'ttf' => 'font/ttf',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
        'svg' => 'image/svg+xml',
        'ico' => 'image/x-icon',
    ];
    $type = $types[strtolower(pathinfo($file, PATHINFO_EXTENSION))] ?? null;

    // The built-in server ignores headers set before `return false`, so known
    // static types are served here with long-lived cache headers.
    if ($type !== null && is_file($file)) {
        header('Content-Type: '.$type);
        header('Content-Length: '.filesize($file));
        header('Cache-Control: public, max-age=31536000, immutable');
        readfile($file);

        return true;
    }

    return false;
}

$formattedDateTime = date('D M j H:i:s Y');

$requestMethod = $_SERVER['REQUEST_METHOD'];
$remoteAddress = $_SERVER['REMOTE_ADDR'].':'.$_SERVER['REMOTE_PORT'];

file_put_contents('php://stdout', "[$formattedDateTime] $remoteAddress [$requestMethod] URI: $uri\n");

require_once $publicPath.'/index.php';
