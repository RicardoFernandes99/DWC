<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Exceptions\ApiSessionExpired;
use App\Exceptions\BackofficeUnavailable;
use App\Services\NestAuthService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use UnexpectedValueException;

final class RequireCurrentAdmin
{
    public function __construct(private readonly NestAuthService $auth) {}

    public function handle(Request $request, Closure $next): Response
    {
        $credentials = $request->session()->get('nest_api');
        if (! is_array($credentials)) {
            return redirect()->route('login');
        }

        try {
            $apiSession = $this->auth->currentAdmin($credentials);
        } catch (ApiSessionExpired|UnexpectedValueException) {
            $this->auth->logoutFrom($credentials);
            $this->clearSession($request);

            return redirect()->route('login')->with('notice', 'Your sign-in expired. Sign in again to continue.');
        } catch (BackofficeUnavailable) {
            return response()->view('errors.unavailable', [], 503);
        }

        $request->session()->put('nest_api', $apiSession->toSession());
        $request->session()->put('admin_identity', [
            'name' => $apiSession->identity->name,
            'email' => $apiSession->identity->email,
            'role' => $apiSession->identity->role,
        ]);

        if (! $apiSession->identity->isAdmin()) {
            $this->auth->logoutFrom($apiSession->toSession());
            $this->clearSession($request);

            return redirect()->route('login')->with('notice', 'Administrator access is required.');
        }

        return $next($request);
    }

    private function clearSession(Request $request): void
    {
        $request->session()->invalidate();
        $request->session()->regenerateToken();
    }
}
