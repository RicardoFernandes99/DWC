@props(['title'])
<section {{ $attributes->merge(['class' => 'empty-state moderation-empty']) }}>
    <div>
        <h2>{{ $title }}</h2>
        @if (! $slot->isEmpty())<p>{{ $slot }}</p>@endif
    </div>
</section>
