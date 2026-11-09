@props(['type' => 'notice'])
@if ($type === 'error')
    <div {{ $attributes->merge(['class' => 'form-error', 'role' => 'alert']) }}>{{ $slot }}</div>
@else
    <p {{ $attributes->merge(['class' => 'notice', 'role' => 'status']) }}>{{ $slot }}</p>
@endif
