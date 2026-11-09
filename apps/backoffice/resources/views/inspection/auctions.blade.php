@extends('layouts.app')

@section('title', 'Auctions | DWC Backoffice')

@section('content')
<x-page>
    <x-page-heading eyebrow="Administration / Inspection" title="Auctions" />
    @include('inspection.filter-errors')
    @include('inspection.filter-scope')
    <x-filters :action="route('inspection.auctions')">
        <x-filter-select label="Status" name="status" :options="['' => 'All statuses', 'scheduled' => 'Scheduled', 'active' => 'Active', 'finished' => 'Finished', 'cancelled' => 'Cancelled']" />
        <x-filter-input label="Producer ID" name="producerId" maxlength="24" pattern="[a-fA-F0-9]{24}" placeholder="24-character ID" />
        <x-filter-select label="Page size" name="limit" :options="['20' => '20', '50' => '50']" />
    </x-filters>

    @if ($items === [])
        <x-empty-state title="No auctions match these filters" />
    @else
        <x-ui.table variant="card" aria-label="Auctions">
            <x-ui.table-header>
                <tr class="border-b">
                    <th scope="col" class="text-foreground h-10 px-4 text-start align-middle font-medium whitespace-nowrap">Product</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Status</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Current bid</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Producer</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Starts</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Ends</th>
                </tr>
            </x-ui.table-header>
            <x-ui.table-body>
                @foreach ($items as $auction)
                    <tr class="hover:bg-muted/50 border-b transition-colors">
                        <td class="px-4 py-3 align-middle">
                            <a class="font-semibold underline-offset-4 hover:underline" href="{{ route('inspection.auction', $auction['id']) }}">{{ $auction['product']['name'] }}</a>
                            <div class="text-muted-foreground text-xs">{{ $auction['quantity'] }} {{ str_replace('_', ' ', $auction['product']['unit']) }}</div>
                        </td>
                        <td class="p-2 align-middle whitespace-nowrap"><x-status-pill :tone="$auction['status']">{{ ucfirst($auction['status']) }}</x-status-pill></td>
                        <td class="p-2 align-middle whitespace-nowrap">{{ $auction['currentBidCents'] === null ? 'No bids' : '€'.number_format($auction['currentBidCents'] / 100, 2) }}</td>
                        <td class="p-2 align-middle whitespace-nowrap"><a class="underline-offset-4 hover:underline" href="{{ route('inspection.user', $auction['producerId']) }}">{{ substr($auction['producerId'], -8) }}</a></td>
                        <td class="p-2 align-middle whitespace-nowrap"><time datetime="{{ $auction['startsAt'] }}">{{ \Carbon\Carbon::parse($auction['startsAt'])->format('j M Y, H:i') }}</time></td>
                        <td class="p-2 align-middle whitespace-nowrap"><time datetime="{{ $auction['endsAt'] }}">{{ \Carbon\Carbon::parse($auction['endsAt'])->format('j M Y, H:i') }}</time></td>
                    </tr>
                @endforeach
            </x-ui.table-body>
        </x-ui.table>
    @endif
    @include('inspection.pagination')
</x-page>
@endsection
