@props(['title'])
<x-ui.empty class="bg-card border">
    <x-ui.empty-header>
        <x-ui.empty-title>{{ $title }}</x-ui.empty-title>
        @if (! $slot->isEmpty())<x-ui.empty-description>{{ $slot }}</x-ui.empty-description>@endif
    </x-ui.empty-header>
</x-ui.empty>
