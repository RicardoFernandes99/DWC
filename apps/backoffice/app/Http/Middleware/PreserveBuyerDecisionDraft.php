<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\Response;

final class PreserveBuyerDecisionDraft
{
    public function handle(Request $request, Closure $next): Response
    {
        $id = $request->route('id');
        $action = $request->route('action');
        $reason = $request->input('reason');
        $draft = null;
        if ($request->isMethod('POST') && is_string($id)
            && preg_match('/\A[a-f\d]{24}\z/i', $id) === 1
            && $action === 'suspend' && is_string($reason)
            && trim($reason) !== '' && mb_strlen(trim($reason)) <= 500) {
            $draft = ['id' => $id, 'action' => $action, 'reason' => trim($reason)];
            $request->session()->put('buyer_decision_draft', $draft);
        }

        $response = $next($request);
        $content = $response instanceof \Illuminate\Http\Response ? $response->getOriginalContent() : null;
        if ($response->getStatusCode() === 503 && $draft !== null
            && $content instanceof View && $content->name() === 'errors.unavailable') {
            return response()->view('inspection.buyer-standing-unavailable', [
                'id' => $draft['id'], 'action' => $draft['action'],
                'reason' => $draft['reason'], 'notSent' => true,
            ], 503);
        }

        return $response;
    }
}
