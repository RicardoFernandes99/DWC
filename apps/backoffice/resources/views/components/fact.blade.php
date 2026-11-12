{{-- One label/value pair inside <x-facts>. Pass mono for IDs. --}}
@props(['label', 'mono' => false])
<div class="flex min-w-0 flex-col gap-1"><dt class="text-muted-foreground text-xs font-medium">{{ $label }}</dt><dd @class(['text-sm break-words', 'font-mono text-xs break-all' => $mono])>{{ $slot }}</dd></div>
