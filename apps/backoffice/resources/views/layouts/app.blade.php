@php
    $asset = fn (string $file): string => asset('build/'.$file).'?v='.(@filemtime(public_path('build/'.$file)) ?: 0);
    $signedIn = session()->has('admin_identity');
    $sections = [
        ['Applications', 'producer-applications.index', 'producer-applications.*'],
        ['Reviews', 'moderation.reviews', 'moderation.review*'],
        ['Products', 'moderation.products', 'moderation.product*'],
        ['Users', 'inspection.users', 'inspection.user*'],
        ['Orders', 'inspection.orders', 'inspection.order*'],
        ['Auctions', 'inspection.auctions', 'inspection.auction*'],
    ];
@endphp
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', 'DWC Backoffice')</title>
    <link rel="preload" href="{{ asset('fonts/fraunces-regular.ttf') }}" as="font" type="font/ttf" crossorigin>
    <link rel="stylesheet" href="{{ $asset('app.css') }}">
    <script type="module" src="{{ $asset('app.js') }}"></script>
    {{-- Chromium: prepare same-site pages as soon as a link is hovered or focused. --}}
    <script type="speculationrules">
        {"prerender":[{"where":{"and":[{"href_matches":"/*"},{"not":{"href_matches":"/logout"}}]},"eagerness":"moderate"}]}
    </script>
    <style>@view-transition { navigation: auto; } ::view-transition-old(root), ::view-transition-new(root) { animation-duration: 140ms; } @media (prefers-reduced-motion: reduce) { @view-transition { navigation: none; } }</style>
</head>
<body class="min-h-screen">
    <header class="bg-card sticky top-0 z-10 border-b">
        <div class="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 sm:px-8">
            <a class="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight" href="{{ $signedIn ? route('home') : route('login') }}" aria-label="DWC backoffice home">
                <span class="text-primary border-primary grid size-[34px] place-items-center rounded-full border" aria-hidden="true">
                    <svg class="size-6" viewBox="0 0 40 40" fill="none"><path d="M20 30V15m0 7c-5 0-8-3-8-8 5 0 8 3 8 8Zm0-4c0-5 3-8 8-8 0 5-3 8-8 8Zm-6 14h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                <span>DWC <span class="text-muted-foreground font-normal">/</span> Backoffice</span>
            </a>
            @if ($signedIn)
                <nav class="order-last -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:mx-0 sm:w-auto sm:flex-1" aria-label="Sections">
                    @foreach ($sections as [$label, $route, $pattern])
                        <x-ui.button :href="route($route)" variant="ghost" size="sm" :aria-current="request()->routeIs($pattern) ? 'page' : null"
                            :class="request()->routeIs($pattern) ? 'rounded-full bg-accent text-accent-foreground' : 'rounded-full text-muted-foreground'">{{ $label }}</x-ui.button>
                    @endforeach
                </nav>
                <div class="ml-auto flex items-center gap-3 sm:ml-0">
                    <span class="text-muted-foreground hidden text-sm sm:inline">{{ session('admin_identity.name') }}</span>
                    <form method="post" action="{{ route('logout') }}">
                        @csrf
                        <x-ui.button type="submit" variant="outline" size="sm">Sign out</x-ui.button>
                    </form>
                </div>
            @endif
        </div>
    </header>
    @yield('content')
</body>
</html>
