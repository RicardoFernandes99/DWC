<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', 'DWC Backoffice')</title>
    <link rel="preload" href="{{ asset('fonts/fraunces-regular.ttf') }}" as="font" type="font/ttf" crossorigin>
    <link rel="stylesheet" href="{{ asset('app.css') }}?v={{ filemtime(public_path('app.css')) }}">
    <link rel="stylesheet" href="{{ asset('theme.css') }}?v={{ filemtime(public_path('theme.css')) }}">
    {{-- Chromium: prepare same-site pages as soon as a link is hovered or focused. --}}
    <script type="speculationrules">
        {"prerender":[{"where":{"and":[{"href_matches":"/*"},{"not":{"href_matches":"/logout"}}]},"eagerness":"moderate"}]}
    </script>
</head>
<body>
    <header class="site-header">
        <a class="brand" href="{{ session()->has('admin_identity') ? route('home') : route('login') }}" aria-label="DWC backoffice home">
            <span class="brand-mark" aria-hidden="true">
                <svg viewBox="0 0 40 40" fill="none"><path d="M20 30V15m0 7c-5 0-8-3-8-8 5 0 8 3 8 8Zm0-4c0-5 3-8 8-8 0 5-3 8-8 8Zm-6 14h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
            <span>DWC <span class="brand-divider">/</span> Backoffice</span>
        </a>
        @if (session()->has('admin_identity'))
            <nav class="site-nav" aria-label="Sections">
                <a href="{{ route('producer-applications.index') }}" @if (request()->routeIs('producer-applications.*')) aria-current="page" @endif>Applications</a>
                <a href="{{ route('moderation.reviews') }}" @if (request()->routeIs('moderation.reviews', 'moderation.review')) aria-current="page" @endif>Reviews</a>
                <a href="{{ route('moderation.products') }}" @if (request()->routeIs('moderation.products', 'moderation.product')) aria-current="page" @endif>Products</a>
                <a href="{{ route('inspection.users') }}" @if (request()->routeIs('inspection.users', 'inspection.user')) aria-current="page" @endif>Users</a>
                <a href="{{ route('inspection.orders') }}" @if (request()->routeIs('inspection.orders', 'inspection.order')) aria-current="page" @endif>Orders</a>
                <a href="{{ route('inspection.auctions') }}" @if (request()->routeIs('inspection.auctions', 'inspection.auction')) aria-current="page" @endif>Auctions</a>
            </nav>
            <div class="header-user">
                <span class="header-user-name">{{ session('admin_identity.name') }}</span>
                <form method="post" action="{{ route('logout') }}">
                    @csrf
                    <button class="quiet-button" type="submit">Sign out</button>
                </form>
            </div>
        @endif
    </header>
    @yield('content')
</body>
</html>
