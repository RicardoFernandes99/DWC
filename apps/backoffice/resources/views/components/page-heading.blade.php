{{-- Page title block: eyebrow, h1, optional intro text (slot). --}}
@props(['eyebrow', 'title'])
<div class="workspace-heading">
    <div>
        <p class="eyebrow">{{ $eyebrow }}</p>
        <h1>{{ $title }}</h1>
        @if (! $slot->isEmpty())<p class="page-intro">{{ $slot }}</p>@endif
    </div>
</div>
