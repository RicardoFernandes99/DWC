<?php

declare(strict_types=1);

namespace App\Services;

use App\DTOs\ApiIdentity;
use App\DTOs\NestApiCredentials;
use App\DTOs\NestApiSession;
use App\Exceptions\ApiSessionExpired;
use App\Exceptions\BackofficeUnavailable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use UnexpectedValueException;

final class NestAuthService
{
    public function login(string $email, string $password): ?NestApiSession
    {
        try {
            $response = $this->request()->post($this->url('auth/login'), [
                'email' => $email,
                'password' => $password,
            ]);
        } catch (ConnectionException) {
            throw new BackofficeUnavailable;
        }

        if ($response->status() === 401) {
            return null;
        }

        if (! $response->successful()) {
            throw new BackofficeUnavailable;
        }

        return $this->sessionFromResponse($response);
    }

    /** @param array<string, mixed> $credentials */
    public function currentAdmin(array $credentials): NestApiSession
    {
        $stored = $this->credentialsFromStored($credentials);
        if ($stored->expiresAt <= time()) {
            throw new ApiSessionExpired;
        }

        $identity = $this->currentIdentity($stored->accessToken);
        if ($identity !== null) {
            return new NestApiSession($stored->accessToken, $stored->refreshCookie, $stored->expiresAt, $identity);
        }

        $rotated = $this->rotate($stored);
        $identity = $this->currentIdentity($rotated->accessToken);
        if ($identity === null) {
            throw new ApiSessionExpired;
        }

        return new NestApiSession($rotated->accessToken, $rotated->refreshCookie, $rotated->expiresAt, $identity);
    }

    /** @param array<string, mixed> $credentials */
    public function logoutFrom(array $credentials): void
    {
        try {
            $session = $this->credentialsFromStored($credentials);
            $this->request()->withHeaders([
                'Origin' => config('services.nest.backoffice_origin'),
                'Cookie' => 'dwc_refresh='.$session->refreshCookie,
            ])->post($this->url('auth/logout'));
        } catch (ConnectionException|UnexpectedValueException|BackofficeUnavailable) {
            // The browser session is cleared even when the API cannot revoke it.
        }
    }

    private function currentIdentity(string $accessToken): ?ApiIdentity
    {
        try {
            $response = $this->request()->withToken($accessToken)->get($this->url('auth/me'));
        } catch (ConnectionException) {
            throw new BackofficeUnavailable;
        }

        if ($response->status() === 401) {
            return null;
        }

        if (! $response->successful()) {
            throw new BackofficeUnavailable;
        }

        return $this->identityFromResponse($response);
    }

    private function rotate(NestApiCredentials $current): NestApiCredentials
    {
        try {
            $response = $this->request()->withHeaders([
                'Origin' => config('services.nest.backoffice_origin'),
                'Cookie' => 'dwc_refresh='.$current->refreshCookie,
            ])->post($this->url('auth/refresh'));
        } catch (ConnectionException) {
            throw new BackofficeUnavailable;
        }

        if ($response->status() === 401) {
            throw new ApiSessionExpired;
        }

        if (! $response->successful()) {
            throw new BackofficeUnavailable;
        }

        $rotated = $this->sessionFromResponse($response);
        if ($rotated->expiresAt > $current->expiresAt + 1) {
            throw new BackofficeUnavailable;
        }

        return new NestApiCredentials(
            $rotated->accessToken,
            $rotated->refreshCookie,
            min($rotated->expiresAt, $current->expiresAt),
        );
    }

    private function sessionFromResponse(Response $response): NestApiSession
    {
        $payload = $response->json();
        if (! is_array($payload) || ! is_string($payload['accessToken'] ?? null)
            || $payload['accessToken'] === '' || strlen($payload['accessToken']) > 4096) {
            throw new BackofficeUnavailable;
        }

        $user = $payload['user'] ?? null;
        if (! is_array($user)) {
            throw new BackofficeUnavailable;
        }

        $cookie = $this->refreshCookie($response);

        return new NestApiSession(
            $payload['accessToken'],
            $cookie['value'],
            $cookie['expires_at'],
            ApiIdentity::fromApi($user),
        );
    }

    private function credentialsFromStored(array $credentials): NestApiCredentials
    {
        $accessToken = $credentials['access_token'] ?? null;
        $refreshCookie = $credentials['refresh_cookie'] ?? null;
        $expiresAt = $credentials['expires_at'] ?? null;

        if (! is_string($accessToken) || $accessToken === '' || strlen($accessToken) > 4096
            || ! is_string($refreshCookie) || $refreshCookie === '' || strlen($refreshCookie) > 4096
            || ! is_int($expiresAt)) {
            throw new UnexpectedValueException('The server session is invalid.');
        }

        return new NestApiCredentials($accessToken, $refreshCookie, $expiresAt);
    }

    /** @return array{value: string, expires_at: int} */
    private function refreshCookie(Response $response): array
    {
        $setCookies = $response->toPsrResponse()->getHeader('Set-Cookie');
        foreach ($setCookies as $setCookie) {
            if (preg_match('/^dwc_refresh=([^;]*);.*?Expires=([^;]+)/i', $setCookie, $matches) === 1) {
                $expiresAt = strtotime($matches[2]);
                if (is_int($expiresAt) && $expiresAt > time() && $matches[1] !== '') {
                    return ['value' => $matches[1], 'expires_at' => $expiresAt];
                }
            }
        }

        throw new BackofficeUnavailable;
    }

    private function identityFromResponse(Response $response): ApiIdentity
    {
        $payload = $response->json();
        if (! is_array($payload)) {
            throw new BackofficeUnavailable;
        }

        try {
            return ApiIdentity::fromApi($payload);
        } catch (UnexpectedValueException) {
            throw new BackofficeUnavailable;
        }
    }

    private function request(): PendingRequest
    {
        return Http::acceptJson()->asJson()->withoutRedirecting()->connectTimeout(3)->timeout(5);
    }

    private function url(string $path): string
    {
        return rtrim((string) config('services.nest.base_url'), '/').'/'.$path;
    }
}
