<?php

return [

    'paths' => [
        resource_path('views'),
    ],

    'compiled' => env(
        'VIEW_COMPILED_PATH',
        realpath(storage_path('framework/views'))
    ),

    // Skip the per-request template timestamp check (slow on bind mounts).
    'check_cache_timestamps' => env('VIEW_CHECK_TIMESTAMPS', true),

];
