{{-- Labelled text input bound to the current request value. --}}
@props(['label', 'name'])
<label class="text-muted-foreground flex min-w-44 flex-col gap-1.5 text-xs font-medium">{{ $label }}
    <x-ui.input size="sm" :name="$name" :value="request($name)" {{ $attributes }} />
</label>
