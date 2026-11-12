{{-- Standard page container for signed-in admin pages. --}}
<main {{ $attributes->merge(['class' => 'mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-8 pb-16 sm:px-8']) }}>{{ $slot }}</main>
