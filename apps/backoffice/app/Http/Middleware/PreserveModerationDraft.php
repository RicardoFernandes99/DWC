<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\Response;

final class PreserveModerationDraft
{
    public function handle(Request $request, Closure $next): Response
    {
        $kind = $request->route('kind');
        $id = $request->route('id');
        $reason = $request->input('reason');
        $draft = null;
        if ($request->isMethod('POST') && is_string($kind) && in_array($kind, ['product', 'review'], true)
            && is_string($id) && preg_match('/\A[a-f\d]{24}\z/i', $id) === 1
            && is_string($reason) && trim($reason) !== '' && mb_strlen(trim($reason)) <= 500) {
            $draft = ['kind' => $kind, 'id' => $id, 'reason' => trim($reason)];
            $request->session()->put('moderation_draft', $draft);
        }

        $response = $next($request);
        $content = $response instanceof \Illuminate\Http\Response ? $response->getOriginalContent() : null;
        if ($response->getStatusCode() === 503 && $draft !== null
            && $content instanceof View && $content->name() === 'errors.unavailable') {
            return response()->view('moderation.unavailable', [
                ...$draft, 'notSent' => true,
            ], 503);
        }

        return $response;
    }
}
