{{-- tone: pending | approved | rejected | suspended | neutral ... (see .status-* in app.css) --}}
@props(['tone' => 'neutral'])
<span {{ $attributes->class(['status-pill', 'status-'.$tone]) }}>{{ $slot }}</span>
