@props(['active' => false])
<a {{ $attributes->class(['filter-link', 'is-active' => $active]) }} @if ($active) aria-current="page" @endif>{{ $slot }}</a>
