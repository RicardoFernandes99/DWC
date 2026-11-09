{{-- White card section with a title. --}}
@props(['title'])
<section {{ $attributes->merge(['class' => 'inspection-section']) }}><h2>{{ $title }}</h2>
    {{ $slot }}
</section>
