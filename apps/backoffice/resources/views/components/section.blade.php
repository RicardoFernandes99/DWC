{{-- White card section with a title and an optional aside (e.g. a revision label). --}}
@props(['title'])
<x-ui.card>
    <x-ui.card-header>
        <h2 class="text-xl font-normal">{{ $title }}</h2>
        @isset($aside)<x-ui.card-action><span class="text-muted-foreground text-xs">{{ $aside }}</span></x-ui.card-action>@endisset
    </x-ui.card-header>
    <x-ui.card-content class="flex flex-col gap-4">{{ $slot }}</x-ui.card-content>
</x-ui.card>
