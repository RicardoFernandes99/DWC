<?php

declare(strict_types=1);

namespace App\DTOs;

enum ModerationState: string
{
    case All = 'all';
    case Visible = 'visible';
    case Hidden = 'hidden';
}
