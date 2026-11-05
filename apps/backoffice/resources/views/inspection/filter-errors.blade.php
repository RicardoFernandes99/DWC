@if ($errors->any())
    <div class="filter-errors" role="alert" aria-live="assertive" aria-atomic="true">
        <h2>Check the filters</h2>
        <ul>@foreach ($errors->all() as $error)<li>{{ $error }}</li>@endforeach</ul>
    </div>
@endif
