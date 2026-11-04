@extends('layouts.app')

@section('title', 'Producer applications | DWC Backoffice')

@section('header-action')
    <form method="post" action="{{ route('logout') }}">
        @csrf
        <button class="quiet-button" type="submit">Sign out</button>
    </form>
@endsection

@section('content')
<main class="workspace producer-workspace">
    <div class="workspace-heading">
        <div>
            <p class="eyebrow">Administration / Producers</p>
            <h1>Producer applications</h1>
            <p class="page-intro">Review each submitted farm before it can sell through the marketplace.</p>
        </div>
        <div class="identity" aria-label="Signed-in administrator">
            <span class="identity-name">{{ session('admin_identity.name') }}</span>
            <span class="role-label">Administrator</span>
        </div>
    </div>

    @if (session('notice'))
        <p class="notice" role="status">{{ session('notice') }}</p>
    @endif

    <nav class="status-filters" aria-label="Filter applications by status">
        @foreach ([null, ...\App\DTOs\ProducerApplicationStatus::cases()] as $status)
            @php($value = $status?->value ?? '')
            @php($label = $status?->label() ?? 'All')
            <a href="{{ route('producer-applications.index', array_filter(['status' => $value, 'page' => null], fn ($item) => $item !== null && $item !== '')) }}"
                @class(['filter-link', 'is-active' => $statusFilter === $value])
                @if ($statusFilter === $value) aria-current="page" @endif>{{ $label }}</a>
        @endforeach
    </nav>

    @if ($items === [])
        <section class="empty-state application-empty" aria-labelledby="empty-title">
            <div>
                <h2 id="empty-title">No applications here</h2>
                <p>Try another status filter or check back when a producer submits their farm details.</p>
            </div>
        </section>
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
                        <span @class(['status-pill', 'status-'.$item->status->value])>{{ $item->status->label() }}</span>
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
