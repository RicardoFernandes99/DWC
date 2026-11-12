<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use TailwindMerge\Contracts\TailwindMergeContract;
use TailwindMerge\TailwindMerge;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // BlatUI components merge Tailwind classes on every render. The package
        // caches merges in the default (file) store, where each lookup is a disk
        // read; an in-memory store keeps pages fast.
        $this->app->singleton(TailwindMergeContract::class, static fn (): TailwindMerge => TailwindMerge::factory()
            ->withConfiguration(config('tailwind-merge', []))
            ->withCache(app('cache')->store('array'))
            ->make());
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
