{{-- Labelled native select bound to the current request value. --}}
@props(['label', 'name', 'options'])
<label class="text-muted-foreground flex min-w-36 flex-col gap-1.5 text-xs font-medium">{{ $label }}
    <x-ui.select native size="sm" :name="$name" :value="(string) request($name, '')" :options="$options" />
</label>
