{{-- GET filter form: put <x-filter-select> / <x-filter-input> inside. --}}
@props(['action'])
<form method="get" action="{{ $action }}" class="bg-card flex flex-wrap items-end gap-3 rounded-lg border p-4">
    {{ $slot }}
    <x-ui.button type="submit" variant="outline" size="sm">Apply filters</x-ui.button>
    <x-ui.button :href="$action" variant="link" size="sm">Clear</x-ui.button>
</form>
