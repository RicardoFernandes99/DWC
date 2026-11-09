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
                <tr class="border-b">
                    <th scope="col" class="text-foreground h-10 px-4 text-start align-middle font-medium whitespace-nowrap">Farm</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Location</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Status</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Submitted</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap"><span class="sr-only">Action</span></th>
                </tr>
            </x-ui.table-header>
            <x-ui.table-body>
                @foreach ($items as $item)
                    <tr class="hover:bg-muted/50 border-b transition-colors">
                        <td class="px-4 py-3 align-middle">
                            <a class="font-semibold underline-offset-4 hover:underline" href="{{ route('producer-applications.show', $item->id) }}">{{ $item->application['farmName'] }}</a>
                            <div class="text-muted-foreground text-xs">{{ $item->name }} · {{ $item->email }}</div>
                        </td>
                        <td class="p-2 align-middle whitespace-nowrap">{{ $item->application['city'] }}</td>
                        <td class="p-2 align-middle whitespace-nowrap"><x-status-pill :tone="$item->status->value">{{ $item->status->label() }}</x-status-pill></td>
                        <td class="p-2 align-middle whitespace-nowrap"><time datetime="{{ $item->submittedAt }}">{{ \Illuminate\Support\Carbon::parse($item->submittedAt)->format('j M Y') }}</time></td>
                        <td class="p-2 align-middle whitespace-nowrap text-right"><a class="text-primary text-sm font-medium underline-offset-4 hover:underline" href="{{ route('producer-applications.show', $item->id) }}">Review<span class="sr-only"> {{ $item->application['farmName'] }}</span> →</a></td>
                    </tr>
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
