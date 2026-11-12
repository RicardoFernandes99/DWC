<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\DTOs\AdminModerationProduct;
use App\DTOs\AdminReportedReview;
use App\DTOs\ModerationState;
use App\Exceptions\ApiSessionExpired;
use App\Exceptions\BackofficeUnavailable;
use App\Exceptions\ProducerApiFailure;
use App\Services\NestAuthService;
use App\Services\NestModerationService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use UnexpectedValueException;

final class AdminModerationController
{
    public function __construct(
        private readonly NestModerationService $moderation,
        private readonly NestAuthService $auth,
    ) {}

    public function products(Request $request): View|RedirectResponse|HttpResponse
    {
        $validator = Validator::make($request->query(), [
            'state' => ['nullable', 'string', Rule::enum(ModerationState::class)],
            'page' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);
        if ($validator->fails()) {
            return redirect()->route('moderation.products')->withErrors($validator);
        }
        $input = $validator->validated();
        $state = ModerationState::from($input['state'] ?? 'all');
        try {
            return view('moderation.products', $this->moderation->products(
                $this->credentials($request), (int) ($input['page'] ?? 1), $state,
            ) + ['state' => $state]);
        } catch (ApiSessionExpired|UnexpectedValueException) {
            return $this->expired($request);
        } catch (ProducerApiFailure|BackofficeUnavailable|ConnectionException) {
            return response()->view('moderation.read-unavailable', [
                'routeName' => 'moderation.products', 'routeParameters' => $request->query(),
            ], 503);
        }
    }

    public function reviews(Request $request): View|RedirectResponse|HttpResponse
    {
        $validator = Validator::make($request->query(), [
            'state' => ['nullable', 'string', Rule::enum(ModerationState::class)],
            'page' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);
        if ($validator->fails()) {
            return redirect()->route('moderation.reviews')->withErrors($validator);
        }
        $input = $validator->validated();
        $state = ModerationState::from($input['state'] ?? 'all');
        try {
            return view('moderation.reviews', $this->moderation->reviews(
                $this->credentials($request), (int) ($input['page'] ?? 1), $state,
            ) + ['state' => $state]);
        } catch (ApiSessionExpired|UnexpectedValueException) {
            return $this->expired($request);
        } catch (ProducerApiFailure|BackofficeUnavailable|ConnectionException) {
            return response()->view('moderation.read-unavailable', [
                'routeName' => 'moderation.reviews', 'routeParameters' => $request->query(),
            ], 503);
        }
    }

    public function product(Request $request, string $id): View|RedirectResponse|HttpResponse
    {
        $this->requireValidId($id);
        try {
            $product = $this->moderation->product($this->credentials($request), $id);
        } catch (ApiSessionExpired|UnexpectedValueException) {
            return $this->expired($request);
        } catch (ProducerApiFailure $failure) {
            abort($failure->status === 404 ? 404 : 400);
        } catch (BackofficeUnavailable|ConnectionException) {
            return response()->view('moderation.read-unavailable', [
                'routeName' => 'moderation.product', 'routeParameters' => ['id' => $id],
            ], 503);
        }

        return view('moderation.product', [
            'product' => $product,
            'draft' => $this->draft($request, 'product', $id),
            'moderationError' => session('moderation_error'),
            'conflict' => (bool) session('moderation_conflict'),
        ]);
    }

    public function review(Request $request, string $id): View|RedirectResponse|HttpResponse
    {
        $this->requireValidId($id);
        try {
            $review = $this->moderation->review($this->credentials($request), $id);
        } catch (ApiSessionExpired|UnexpectedValueException) {
            return $this->expired($request);
        } catch (ProducerApiFailure $failure) {
            abort($failure->status === 404 ? 404 : 400);
        } catch (BackofficeUnavailable|ConnectionException) {
            return response()->view('moderation.read-unavailable', [
                'routeName' => 'moderation.review', 'routeParameters' => ['id' => $id],
            ], 503);
        }

        return view('moderation.review', [
            'review' => $review,
            'draft' => $this->draft($request, 'review', $id),
            'moderationError' => session('moderation_error'),
            'conflict' => (bool) session('moderation_conflict'),
        ]);
    }

    public function hide(Request $request, string $kind, string $id): RedirectResponse|HttpResponse
    {
        if (! in_array($kind, ['product', 'review'], true)) {
            abort(404);
        }
        $this->requireValidId($id);
        $input = $request->validate([
            'revision' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'min:1', 'max:500'],
        ]);
        $input['revision'] = (int) $input['revision'];
        $input['reason'] = trim($input['reason']);
        if ($input['reason'] === '') {
            return back()->withInput()->withErrors(['reason' => 'Enter a reason of up to 500 characters.']);
        }
        $request->session()->put('moderation_draft', ['kind' => $kind, 'id' => $id, 'reason' => $input['reason']]);

        try {
            $updated = $this->moderation->hide($this->credentials($request), $kind, $id, $input);
            $confirmed = $kind === 'product'
                ? $updated instanceof AdminModerationProduct && $updated->id === $id && $updated->moderation !== null
                : $updated instanceof AdminReportedReview && $updated->reviewId === $id && $updated->visibility === 'hidden';
            if (! $confirmed) {
                throw new BackofficeUnavailable;
            }
        } catch (ApiSessionExpired|UnexpectedValueException) {
            return $this->expired($request);
        } catch (ProducerApiFailure $failure) {
            if ($failure->status === 404) {
                abort(404);
            }
            if ($failure->status === 409) {
                return redirect()->route($kind === 'product' ? 'moderation.product' : 'moderation.review', $id)
                    ->with('moderation_error', $failure->getMessage())
                    ->with('moderation_conflict', true);
            }

            return redirect()->route($kind === 'product' ? 'moderation.product' : 'moderation.review', $id)
                ->with('moderation_error', $failure->getMessage());
        } catch (BackofficeUnavailable|ConnectionException) {
            return response()->view('moderation.unavailable', [
                'kind' => $kind, 'id' => $id, 'reason' => $input['reason'], 'notSent' => false,
            ], 503);
        }

        $request->session()->forget('moderation_draft');

        return redirect()->route($kind === 'product' ? 'moderation.product' : 'moderation.review', $id)
            ->with('notice', $kind === 'product'
                ? 'Product hidden from public product views and checkout. Publication, stock and auction records were not changed.'
                : 'Review hidden from public review lists and rating totals.');
    }

    private function draft(Request $request, string $kind, string $id): ?array
    {
        $draft = $request->session()->get('moderation_draft');

        return is_array($draft) && ($draft['kind'] ?? null) === $kind && ($draft['id'] ?? null) === $id
            && is_string($draft['reason'] ?? null) ? $draft : null;
    }

    private function credentials(Request $request): array
    {
        $credentials = $request->session()->get('nest_api');
        if (! is_array($credentials)) {
            throw new UnexpectedValueException('The server session is invalid.');
        }

        return $credentials;
    }

    private function expired(Request $request): RedirectResponse
    {
        $credentials = $request->session()->get('nest_api');
        if (is_array($credentials)) {
            $this->auth->logoutFrom($credentials);
        }
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login')->with('notice', 'Your sign-in expired. Sign in again to continue.');
    }

    private function requireValidId(string $id): void
    {
        if (preg_match('/\A[a-f\d]{24}\z/i', $id) !== 1) {
            abort(404);
        }
    }
}
