@extends('layouts.app')

@section('title', 'Product moderation | DWC Backoffice')

@section('content')
<x-page>
    <x-page-heading eyebrow="Administration / Content" title="Products">Check a listing's current moderation and publication state before hiding it.</x-page-heading>

    <x-tabs aria-label="Filter products by moderation state">
        @foreach ([\App\DTOs\ModerationState::All, \App\DTOs\ModerationState::Hidden] as $filter)
            <x-tab :href="route('moderation.products', ['state' => $filter->value])" :active="$state === $filter">{{ $filter === \App\DTOs\ModerationState::All ? 'All' : 'Hidden' }}</x-tab>
        @endforeach
    </x-tabs>

    @if ($items === [])
        <x-empty-state title="No products in this view">Hidden products appear here once you hide one.</x-empty-state>
    @else
        <x-ui.table variant="card" aria-label="Products">
            <x-ui.table-header>
                <tr class="border-b">
                    <th scope="col" class="text-foreground h-10 px-4 text-start align-middle font-medium whitespace-nowrap">Product</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Moderation</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Published by producer</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Added</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap"><span class="sr-only">Action</span></th>
                </tr>
            </x-ui.table-header>
            <x-ui.table-body>
                @foreach ($items as $item)
                    <tr class="hover:bg-muted/50 border-b transition-colors">
                        <td class="px-4 py-3 align-middle">
                            <a class="font-semibold underline-offset-4 hover:underline" href="{{ route('moderation.product', $item->id) }}">{{ $item->name }}</a>
                            <div class="text-muted-foreground text-xs">{{ $item->producerName }} · {{ ucfirst(str_replace('_', ' ', $item->category)) }}</div>
                        </td>
                        <td class="p-2 align-middle whitespace-nowrap"><x-status-pill :tone="$item->moderation === null ? 'approved' : 'suspended'">{{ $item->moderation === null ? 'Not hidden' : 'Hidden' }}</x-status-pill></td>
                        <td class="p-2 align-middle whitespace-nowrap">{{ $item->published ? 'Yes' : 'No' }}</td>
                        <td class="p-2 align-middle whitespace-nowrap"><time datetime="{{ $item->createdAt }}">{{ \Illuminate\Support\Carbon::parse($item->createdAt)->format('j M Y') }}</time></td>
                        <td class="p-2 align-middle whitespace-nowrap text-right"><a class="text-primary text-sm font-medium underline-offset-4 hover:underline" href="{{ route('moderation.product', $item->id) }}">Inspect<span class="sr-only"> {{ $item->name }}</span> →</a></td>
                    </tr>
                @endforeach
            </x-ui.table-body>
        </x-ui.table>
    @endif
    @include('moderation.pagination', ['routeName' => 'moderation.products'])
</x-page>
@endsection
