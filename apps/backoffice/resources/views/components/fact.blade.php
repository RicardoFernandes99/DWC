{{-- One label/value pair inside a <dl class="inspection-facts">. Pass mono for IDs. --}}
@props(['label', 'mono' => false])
<div><dt>{{ $label }}</dt><dd @class(['inspection-id' => $mono])>{{ $slot }}</dd></div>
