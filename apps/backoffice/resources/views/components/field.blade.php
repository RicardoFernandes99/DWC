{{-- Small label above a value in list rows (class sets the column wrapper). --}}
@props(['label'])
<div {{ $attributes->merge(['class' => 'inspection-secondary']) }}><span class="inspection-label">{{ $label }}</span>{{ $slot }}</div>
