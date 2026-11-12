{{-- POST form with a required reason textarea (moderation and standing decisions). --}}
@props(['action', 'revision', 'id', 'label', 'help', 'submit', 'danger' => true, 'value' => ''])
<form method="post" action="{{ $action }}" class="flex flex-col gap-3">
    @csrf
    <input type="hidden" name="revision" value="{{ $revision }}">
    <x-ui.field>
        <x-ui.label :for="$id">{{ $label }}</x-ui.label>
        <x-ui.textarea :id="$id" name="reason" rows="4" maxlength="500" required :aria-invalid="$errors->has('reason') ? 'true' : null">{{ old('reason', $value) }}</x-ui.textarea>
        <x-ui.field-description>{{ $help }}</x-ui.field-description>
        @error('reason')<x-ui.field-error>{{ $message }}</x-ui.field-error>@enderror
    </x-ui.field>
    {{ $slot }}
    <x-ui.button type="submit" :variant="$danger ? 'destructive' : 'outline'" class="w-fit">{{ $submit }}</x-ui.button>
</form>
