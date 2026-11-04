<?php

use App\Http\Middleware\PreventBackofficeCaching;
use App\Http\Middleware\RequireCurrentAdmin;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->appendToGroup('web', PreventBackofficeCaching::class);
        $middleware->alias([
            'current-admin' => RequireCurrentAdmin::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
        $exceptions->respond(function (HttpResponse $response): HttpResponse {
            if ($response->getStatusCode() === 419) {
                $request = request();
                $response = $request instanceof Request && $request->expectsJson()
                    ? response()->json(['message' => 'The form expired. Refresh the page and try again.'], 419)
                    : response()->view('errors.419', [], 419);
            }

            $response->headers->set('Cache-Control', 'no-store, private, max-age=0');
            $response->headers->set('Pragma', 'no-cache');
            $response->headers->set('Expires', '0');

            return $response;
        });
    })->create();
