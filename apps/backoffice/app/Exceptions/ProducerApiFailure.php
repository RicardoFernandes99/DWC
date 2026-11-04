<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;

final class ProducerApiFailure extends RuntimeException
{
    public function __construct(public readonly int $status, string $message)
    {
        parent::__construct($message);
    }
}
