{{-- Notice (default) or error banner. --}}
@props(['type' => 'notice'])
@if ($type === 'error')
    <x-ui.alert tone="danger" role="alert"><x-ui.alert-description>{{ $slot }}</x-ui.alert-description></x-ui.alert>
@else
    <x-ui.alert tone="success" role="status"><x-ui.alert-description>{{ $slot }}</x-ui.alert-description></x-ui.alert>
@endif
