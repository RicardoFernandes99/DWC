{{-- Collapsed confirmation step: the summary is the trigger, the slot holds the form. --}}
@props(['summary', 'open' => false])
<details @if ($open) open @endif class="bg-card rounded-lg border">
    <summary class="cursor-pointer px-4 py-3 text-sm font-medium">{{ $summary }}</summary>
    <div class="flex flex-col gap-3 border-t p-4">{{ $slot }}</div>
</details>
