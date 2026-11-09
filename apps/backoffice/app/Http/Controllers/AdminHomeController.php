<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;

/** The admin landing page is the producer applications queue. */
final class AdminHomeController
{
    public function __invoke(): RedirectResponse
    {
        return redirect()->route('producer-applications.index');
    }
}
