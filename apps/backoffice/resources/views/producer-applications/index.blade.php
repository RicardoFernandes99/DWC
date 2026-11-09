@extends('layouts.app')

@section('title', 'Producer applications | DWC Backoffice')

@section('content')
<main class="workspace producer-workspace">
    <x-page-heading eyebrow="Administration / Producers" title="Producer applications">Review each submitted farm before it can sell through the marketplace.</x-page-heading>

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
        <x-empty-state class="application-empty" title="No applications here">Try another status filter or check back when a producer submits their farm details.</x-empty-state>
    @else
        <section class="application-list" aria-label="Producer applications">
            @foreach ($items as $item)
                <article class="application-row">
                    <div class="application-farm">
                        <a class="application-link" href="{{ route('producer-applications.show', $item->id) }}">{{ $item->application['farmName'] }}</a>
                        <span class="application-person">{{ $item->name }} <span aria-hidden="true">·</span> {{ $item->email }}</span>
                    </div>
                    <div class="application-place">
                        <span class="list-label">Farm location</span>
                        <span>{{ $item->application['city'] }}</span>
                    </div>
                    <div class="application-state">
                        <span class="list-label">Status</span>
                        <x-status-pill :tone="$item->status->value">{{ $item->status->label() }}</x-status-pill>
                    </div>
                    <div class="application-submission">
                        <span class="list-label">Submitted</span>
                        <time datetime="{{ $item->submittedAt }}">{{ \Illuminate\Support\Carbon::parse($item->submittedAt)->format('j M Y') }}</time>
                    </div>
                    <a class="row-action" href="{{ route('producer-applications.show', $item->id) }}">Review<span class="sr-only"> {{ $item->application['farmName'] }}</span><span aria-hidden="true"> →</span></a>
                </article>
            @endforeach
        </section>

        <nav class="pagination" aria-label="Application pages">
            <span>Page {{ $page }} · {{ $total }} {{ \Illuminate\Support\Str::plural('application', $total) }}</span>
            <div class="pagination-actions">
                @if ($page > 1)
                    <a class="quiet-button pagination-link" href="{{ route('producer-applications.index', array_filter(['status' => $statusFilter, 'page' => $page - 1], fn ($value) => $value !== '')) }}">Previous</a>
                @endif
                @if ($page * $limit < $total)
                    <a class="quiet-button pagination-link" href="{{ route('producer-applications.index', array_filter(['status' => $statusFilter, 'page' => $page + 1], fn ($value) => $value !== '')) }}">Next</a>
                @endif
            </div>
        </nav>
    @endif
</main>
@endsection
