@if ($errors->any())
    <x-ui.alert tone="danger" role="alert">
        <x-ui.alert-title>Check the filters</x-ui.alert-title>
        <x-ui.alert-description><ul class="list-disc pl-5">@foreach ($errors->all() as $error)<li>{{ $error }}</li>@endforeach</ul></x-ui.alert-description>
    </x-ui.alert>
@endif
