{{-- Grid of <x-fact> label/value pairs. --}}
<dl {{ $attributes->merge(['class' => 'grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3']) }}>{{ $slot }}</dl>
