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
                <tr class="border-b">
                    <th scope="col" class="text-foreground h-10 px-4 text-start align-middle font-medium whitespace-nowrap">Review</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Rating</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Reports</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Latest report</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Visibility</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap"><span class="sr-only">Action</span></th>
                </tr>
            </x-ui.table-header>
            <x-ui.table-body>
                @foreach ($items as $item)
                    <tr class="hover:bg-muted/50 border-b transition-colors">
                        <td class="max-w-md px-4 py-3 align-middle">
                            <a class="font-semibold underline-offset-4 hover:underline" href="{{ route('moderation.review', $item->reviewId) }}">{{ $item->producer['farmName'] }}</a>
                            <div class="text-sm">{{ $item->comment ?: 'No written comment' }}</div>
                            <div class="text-muted-foreground text-xs">By {{ $item->author['name'] }} · Order {{ $item->orderId }}</div>
                        </td>
                        <td class="p-2 align-middle whitespace-nowrap">{{ $item->rating }} / 5</td>
                        <td class="p-2 align-middle whitespace-nowrap">{{ $item->reportCount }}</td>
                        <td class="p-2 align-middle whitespace-nowrap"><time datetime="{{ $item->latestReportAt }}">{{ $item->latestReportAt ? \Illuminate\Support\Carbon::parse($item->latestReportAt)->format('j M Y') : '—' }}</time></td>
                        <td class="p-2 align-middle whitespace-nowrap"><x-status-pill :tone="$item->visibility">{{ ucfirst($item->visibility) }}</x-status-pill></td>
                        <td class="p-2 align-middle whitespace-nowrap text-right"><a class="text-primary text-sm font-medium underline-offset-4 hover:underline" href="{{ route('moderation.review', $item->reviewId) }}">Inspect<span class="sr-only"> review by {{ $item->author['name'] }}</span> →</a></td>
                    </tr>
                @endforeach
            </x-ui.table-body>
        </x-ui.table>
    @endif
    @include('moderation.pagination', ['routeName' => 'moderation.reviews'])
</x-page>
@endsection
