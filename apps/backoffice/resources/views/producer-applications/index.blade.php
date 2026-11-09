@extends('layouts.app')

@section('title', 'Producer applications | DWC Backoffice')

@section('content')
<x-page>
    <x-page-heading eyebrow="Administration / Producers" title="Producer applications">
        Review each submitted farm before it can sell through the marketplace.
    </x-page-heading>

    @if (session('notice'))
        <x-alert>{{ session('notice') }}</x-alert>
    @endif

    <x-tabs aria-label="Filter applications by status">
        @foreach ([null, ...\App\DTOs\ProducerApplicationStatus::cases()] as $status)
            @php($value = $status?->value ?? '')
            <x-tab :href="route('producer-applications.index', array_filter(['status' => $value, 'page' => null], fn ($item) => $item !== null && $item !== ''))" :active="$statusFilter === $value">{{ $status?->label() ?? 'All' }}</x-tab>
        @endforeach
    </x-tabs>

    @if ($items === [])
        <x-empty-state title="No applications here">Try another status filter or check back when a producer submits their farm details.</x-empty-state>
    @else
        <x-ui.table variant="card" aria-label="Producer applications">
            <x-ui.table-header>
                <x-ui.table-row class="hover:bg-transparent">
                    <x-ui.table-head class="px-4">Farm</x-ui.table-head>
                    <x-ui.table-head>Location</x-ui.table-head>
                    <x-ui.table-head>Status</x-ui.table-head>
                    <x-ui.table-head>Submitted</x-ui.table-head>
                    <x-ui.table-head><span class="sr-only">Action</span></x-ui.table-head>
                </x-ui.table-row>
            </x-ui.table-header>
            <x-ui.table-body>
                @foreach ($items as $item)
                    <x-ui.table-row>
                        <x-ui.table-cell class="px-4 py-3 whitespace-normal">
                            <a class="font-semibold underline-offset-4 hover:underline" href="{{ route('producer-applications.show', $item->id) }}">{{ $item->application['farmName'] }}</a>
                            <div class="text-muted-foreground text-xs">{{ $item->name }} · {{ $item->email }}</div>
                        </x-ui.table-cell>
                        <x-ui.table-cell>{{ $item->application['city'] }}</x-ui.table-cell>
                        <x-ui.table-cell><x-status-pill :tone="$item->status->value">{{ $item->status->label() }}</x-status-pill></x-ui.table-cell>
                        <x-ui.table-cell><time datetime="{{ $item->submittedAt }}">{{ \Illuminate\Support\Carbon::parse($item->submittedAt)->format('j M Y') }}</time></x-ui.table-cell>
                        <x-ui.table-cell class="text-right"><x-ui.button variant="ghost" size="sm" :href="route('producer-applications.show', $item->id)">Review<span class="sr-only"> {{ $item->application['farmName'] }}</span> →</x-ui.button></x-ui.table-cell>
                    </x-ui.table-row>
                @endforeach
            </x-ui.table-body>
        </x-ui.table>

        <x-pager
            :summary="'Page '.$page.' · '.$total.' '.\Illuminate\Support\Str::plural('application', $total)"
            :prev="$page > 1 ? route('producer-applications.index', array_filter(['status' => $statusFilter, 'page' => $page - 1], fn ($value) => $value !== '')) : null"
            :next="$page * $limit < $total ? route('producer-applications.index', array_filter(['status' => $statusFilter, 'page' => $page + 1], fn ($value) => $value !== '')) : null" />
    @endif
</x-page>
@endsection
