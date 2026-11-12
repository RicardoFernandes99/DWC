{{-- GET filter form: put <x-filter-select> / <x-filter-input> inside. Filters apply as you go: selects at once, text after a 300 ms pause. --}}
@props(['action'])
<form
    method="get"
    action="{{ $action }}"
    class="bg-card flex flex-wrap items-end gap-3 rounded-lg border p-4"
    x-data="{
        send(el) {
            if (el.value && !el.checkValidity()) return;
            if (el.name) sessionStorage.setItem('filter-focus', el.name);
            this.$el.requestSubmit();
        },
    }"
    x-init="
        const name = sessionStorage.getItem('filter-focus');
        sessionStorage.removeItem('filter-focus');
        const input = name && $el.querySelector(`input[name='${name}']`);
        if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    "
    x-on:change="if ($event.target.matches('select')) send($event.target)"
    x-on:input.debounce.300ms="if ($event.target.matches('input')) send($event.target)"
>
    {{ $slot }}
    <x-ui.button :href="$action" variant="link" size="sm">Clear</x-ui.button>
</form>
