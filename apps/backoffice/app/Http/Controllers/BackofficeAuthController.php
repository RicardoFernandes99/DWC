<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\BackofficeUnavailable;
use App\Services\NestAuthService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\View\View;
use UnexpectedValueException;

final class BackofficeAuthController
{
    public function __construct(private readonly NestAuthService $auth) {}

    public function showLogin(): View|RedirectResponse
    {
        if (session()->has('nest_api')) {
            return redirect()->route('home');
        }

        return view('auth.login');
    }

    public function login(Request $request): RedirectResponse|HttpResponse
    {
        $input = $request->validate([
            'email' => ['required', 'string', 'email', 'max:254'],
            'password' => ['required', 'string', 'max:72'],
        ]);

        try {
            $apiSession = $this->auth->login($input['email'], $input['password']);
        } catch (BackofficeUnavailable|UnexpectedValueException) {
            return response()->view('errors.unavailable', [], 503);
        }

        if ($apiSession === null) {
            return back()->withInput($request->only('email'))->withErrors([
                'credentials' => 'The email or password is incorrect.',
            ]);
        }

        if (! $apiSession->identity->isAdmin()) {
            $this->auth->logoutFrom($apiSession->toSession());
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()->route('login')->with('notice', 'Administrator access is required.');
        }

        $request->session()->regenerate();
        $request->session()->put('nest_api', $apiSession->toSession());

        return redirect()->route('home');
    }

    public function logout(Request $request): RedirectResponse
    {
        $credentials = $request->session()->get('nest_api');
        if (is_array($credentials)) {
            $this->auth->logoutFrom($credentials);
        }

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login')->with('notice', 'You have signed out.');
    }
}
