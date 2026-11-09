@extends('layouts.app')

@section('title', 'Reported reviews | DWC Backoffice')

@section('content')
<x-page>
    <x-page-heading eyebrow="Administration / Content" title="Reported reviews">Reports are reviewed individually. The report count does not hide a review automatically.</x-page-heading>

    <x-tabs aria-label="Filter reported reviews by visibility">
        @foreach ([\App\DTOs\ModerationState::All, \App\DTOs\ModerationState::Hidden] as $filter)
            <x-tab :href="route('moderation.reviews', ['state' => $filter->value])" :active="$state === $filter">{{ $filter === \App\DTOs\ModerationState::All ? 'All' : 'Hidden' }}</x-tab>
        @endforeach
    </x-tabs>

    @if ($items === [])
        <x-empty-state title="No reported reviews in this view">Reported reviews appear here when a buyer or producer submits a report.</x-empty-state>
    @else
        <x-ui.table variant="card" aria-label="Reported reviews">
            <x-ui.table-header>
                <x-ui.table-row class="hover:bg-transparent">
                    <x-ui.table-head class="px-4">Review</x-ui.table-head>
                    <x-ui.table-head>Rating</x-ui.table-head>
                    <x-ui.table-head>Reports</x-ui.table-head>
                    <x-ui.table-head>Latest report</x-ui.table-head>
                    <x-ui.table-head>Visibility</x-ui.table-head>
                    <x-ui.table-head><span class="sr-only">Action</span></x-ui.table-head>
                </x-ui.table-row>
            </x-ui.table-header>
            <x-ui.table-body>
                @foreach ($items as $item)
                    <x-ui.table-row>
                        <x-ui.table-cell class="max-w-md px-4 py-3 whitespace-normal">
                            <a class="font-semibold underline-offset-4 hover:underline" href="{{ route('moderation.review', $item->reviewId) }}">{{ $item->producer['farmName'] }}</a>
                            <div class="text-sm">{{ $item->comment ?: 'No written comment' }}</div>
                            <div class="text-muted-foreground text-xs">By {{ $item->author['name'] }} · Order {{ $item->orderId }}</div>
                        </x-ui.table-cell>
                        <x-ui.table-cell>{{ $item->rating }} / 5</x-ui.table-cell>
                        <x-ui.table-cell>{{ $item->reportCount }}</x-ui.table-cell>
                        <x-ui.table-cell><time datetime="{{ $item->latestReportAt }}">{{ $item->latestReportAt ? \Illuminate\Support\Carbon::parse($item->latestReportAt)->format('j M Y') : '—' }}</time></x-ui.table-cell>
                        <x-ui.table-cell><x-status-pill :tone="$item->visibility">{{ ucfirst($item->visibility) }}</x-status-pill></x-ui.table-cell>
                        <x-ui.table-cell class="text-right"><x-ui.button variant="ghost" size="sm" :href="route('moderation.review', $item->reviewId)">Inspect<span class="sr-only"> review by {{ $item->author['name'] }}</span> →</x-ui.button></x-ui.table-cell>
                    </x-ui.table-row>
                @endforeach
            </x-ui.table-body>
        </x-ui.table>
    @endif
    @include('moderation.pagination', ['routeName' => 'moderation.reviews'])
</x-page>
@endsection
