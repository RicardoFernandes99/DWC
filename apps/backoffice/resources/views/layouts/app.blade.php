<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', 'DWC Backoffice')</title>
    <link rel="preload" href="{{ asset('fonts/fraunces-regular.ttf') }}" as="font" type="font/ttf" crossorigin>
    <link rel="stylesheet" href="{{ asset('app.css') }}?v={{ filemtime(public_path('app.css')) }}">
    {{-- Chromium: prepare same-site pages as soon as a link is hovered or focused. --}}
    <script type="speculationrules">
        {"prerender":[{"where":{"and":[{"href_matches":"/*"},{"not":{"href_matches":"/logout"}}]},"eagerness":"moderate"}]}
    </script>
</head>
<body>
    <header class="site-header">
        <a class="brand" href="{{ route('login') }}" aria-label="DWC backoffice home">
            <span class="brand-mark" aria-hidden="true">
                <svg viewBox="0 0 40 40" fill="none"><path d="M20 30V15m0 7c-5 0-8-3-8-8 5 0 8 3 8 8Zm0-4c0-5 3-8 8-8 0 5-3 8-8 8Zm-6 14h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
            <span>DWC <span class="brand-divider">/</span> Backoffice</span>
        </a>
        @yield('header-action')
    </header>
    @yield('content')
</body>
</html>
