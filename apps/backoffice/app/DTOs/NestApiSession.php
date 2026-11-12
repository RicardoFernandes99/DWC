<?php

declare(strict_types=1);

namespace App\DTOs;

final readonly class NestApiSession
{
    public function __construct(
        public string $accessToken,
        public string $refreshCookie,
        public int $expiresAt,
        public ApiIdentity $identity,
    ) {}

    /** @return array{access_token: string, refresh_cookie: string, expires_at: int} */
    public function toSession(): array
    {
        return (new NestApiCredentials($this->accessToken, $this->refreshCookie, $this->expiresAt))->toSession();
    }
}
