@props(['active' => false])
<x-ui.button {{ $attributes }} size="sm" :variant="$active ? 'default' : 'outline'" class="rounded-full" :aria-current="$active ? 'page' : null">{{ $slot }}</x-ui.button>
