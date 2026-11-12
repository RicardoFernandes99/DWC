{{-- Neutral callout, e.g. a current moderation record or a saved draft. --}}
@props(['title' => null])
<x-ui.alert tone="neutral">
    @if ($title)<x-ui.alert-title>{{ $title }}</x-ui.alert-title>@endif
    <x-ui.alert-description>{{ $slot }}</x-ui.alert-description>
</x-ui.alert>
