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
                <x-ui.table-row class="hover:bg-transparent">
                    <x-ui.table-head class="px-4">Product</x-ui.table-head>
                    <x-ui.table-head>Moderation</x-ui.table-head>
                    <x-ui.table-head>Published by producer</x-ui.table-head>
                    <x-ui.table-head>Added</x-ui.table-head>
                    <x-ui.table-head><span class="sr-only">Action</span></x-ui.table-head>
                </x-ui.table-row>
            </x-ui.table-header>
            <x-ui.table-body>
                @foreach ($items as $item)
                    <x-ui.table-row>
                        <x-ui.table-cell class="px-4 py-3 whitespace-normal">
                            <a class="font-semibold underline-offset-4 hover:underline" href="{{ route('moderation.product', $item->id) }}">{{ $item->name }}</a>
                            <div class="text-muted-foreground text-xs">{{ $item->producerName }} · {{ ucfirst(str_replace('_', ' ', $item->category)) }}</div>
                        </x-ui.table-cell>
                        <x-ui.table-cell><x-status-pill :tone="$item->moderation === null ? 'approved' : 'suspended'">{{ $item->moderation === null ? 'Not hidden' : 'Hidden' }}</x-status-pill></x-ui.table-cell>
                        <x-ui.table-cell>{{ $item->published ? 'Yes' : 'No' }}</x-ui.table-cell>
                        <x-ui.table-cell><time datetime="{{ $item->createdAt }}">{{ \Illuminate\Support\Carbon::parse($item->createdAt)->format('j M Y') }}</time></x-ui.table-cell>
                        <x-ui.table-cell class="text-right"><x-ui.button variant="ghost" size="sm" :href="route('moderation.product', $item->id)">Inspect<span class="sr-only"> {{ $item->name }}</span> →</x-ui.button></x-ui.table-cell>
                    </x-ui.table-row>
                @endforeach
            </x-ui.table-body>
        </x-ui.table>
    @endif
    @include('moderation.pagination', ['routeName' => 'moderation.products'])
</x-page>
@endsection
