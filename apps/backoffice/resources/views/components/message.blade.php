{{-- Full-page message (errors, unavailable states) with one way back. --}}
@props(['eyebrow', 'title', 'href' => null, 'link' => null])
<main class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-16" role="main">
    <p class="text-primary text-xs font-bold tracking-widest uppercase">{{ $eyebrow }}</p>
    <h1 class="text-3xl font-normal tracking-tight text-balance">{{ $title }}</h1>
    <div class="text-muted-foreground flex flex-col gap-3 text-sm">{{ $slot }}</div>
    @if ($href)<x-ui.button :href="$href" variant="outline" class="w-fit">{{ $link }}</x-ui.button>@endif
</main>
