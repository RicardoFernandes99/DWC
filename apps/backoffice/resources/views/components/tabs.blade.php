{{-- Filter tabs. Put <x-tab> links inside. --}}
<nav {{ $attributes->merge(['class' => 'flex flex-wrap gap-2']) }}>{{ $slot }}</nav>
