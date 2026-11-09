{{-- Filter tabs. Put <x-tab> links inside. --}}
<nav {{ $attributes->merge(['class' => 'status-filters']) }}>{{ $slot }}</nav>
