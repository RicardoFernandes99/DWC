<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\DTOs\AdminProducerApplication;
use App\DTOs\ProducerApplicationStatus;
use App\Exceptions\ApiSessionExpired;
use App\Exceptions\BackofficeUnavailable;
use App\Exceptions\ProducerApiFailure;
use App\Services\NestAuthService;
use App\Services\NestProducerApplicationService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use UnexpectedValueException;

final class AdminProducerApplicationsController
{
    public function __construct(
        private readonly NestProducerApplicationService $applications,
        private readonly NestAuthService $auth,
    ) {}

    public function index(Request $request): View|RedirectResponse|HttpResponse
    {
        $validator = Validator::make($request->query(), [
            'status' => ['nullable', 'string', Rule::enum(ProducerApplicationStatus::class)],
            'page' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);
        if ($validator->fails()) {
            return redirect()->route('producer-applications.index')->withErrors($validator);
        }

        $input = $validator->validated();
        try {
            $page = $this->applications->list(
                $this->credentials($request),
                (int) ($input['page'] ?? 1),
                isset($input['status']) ? ProducerApplicationStatus::from($input['status']) : null,
            );
        } catch (ApiSessionExpired|UnexpectedValueException) {
            return $this->expired($request);
        } catch (BackofficeUnavailable|ConnectionException) {
            return response()->view('errors.unavailable', [], 503);
        }

        return view('producer-applications.index', $page + [
            'statusFilter' => $input['status'] ?? '',
        ]);
    }

    public function show(Request $request, string $id): View|RedirectResponse|HttpResponse
    {
        if (! $this->validId($id)) {
            abort(404);
        }

        try {
            $application = $this->applications->get($this->credentials($request), $id);
        } catch (ApiSessionExpired|UnexpectedValueException) {
            return $this->expired($request);
        } catch (ProducerApiFailure $failure) {
            abort($failure->status === 404 ? 404 : 400);
        } catch (BackofficeUnavailable|ConnectionException) {
            return response()->view('errors.unavailable', [], 503);
        }

        $draft = $request->session()->get('producer_decision_draft');
        $decisionDraft = is_array($draft)
            && ($draft['id'] ?? null) === $id
            && in_array($draft['action'] ?? null, ['reject', 'suspend'], true)
            && is_string($draft['reason'] ?? null)
            ? $draft
            : null;

        return $this->detail($application, $decisionDraft);
    }

    public function decide(Request $request, string $id, string $action): RedirectResponse|HttpResponse
    {
        if (! $this->validId($id) || ! in_array($action, ['approve', 'reject', 'suspend', 'reinstate'], true)) {
            abort(404);
        }

        $rules = ['revision' => ['required', 'integer', 'min:1']];
        if (in_array($action, ['reject', 'suspend'], true)) {
            $rules['reason'] = ['required', 'string', 'min:1', 'max:500'];
        }
        $input = $request->validate($rules);
        $input['revision'] = (int) $input['revision'];
        if (isset($input['reason'])) {
            $input['reason'] = trim($input['reason']);
            if ($input['reason'] === '') {
                return back()->withInput()->withErrors(['reason' => 'Enter a reason of up to 500 characters.']);
            }
        }

        $request->session()->forget('producer_decision_draft');

        try {
            $credentials = $this->credentials($request);
            $updated = in_array($action, ['approve', 'reject'], true)
                ? $this->applications->decide($credentials, $id, $action, $input)
                : $this->applications->changeStanding($credentials, $id, $action, $input);
        } catch (ApiSessionExpired|UnexpectedValueException) {
            return $this->expired($request);
        } catch (ProducerApiFailure $failure) {
            if (isset($input['reason'])) {
                $request->session()->put('producer_decision_draft', [
                    'id' => $id,
                    'action' => $action,
                    'reason' => $input['reason'],
                ]);
            }

            return redirect()->route('producer-applications.show', $id)
                ->with('decision_error', $failure->getMessage())
                ->with('decision_conflict', $failure->status === 409);
        } catch (BackofficeUnavailable|ConnectionException) {
            if (isset($input['reason'])) {
                $request->session()->put('producer_decision_draft', [
                    'id' => $id,
                    'action' => $action,
                    'reason' => $input['reason'],
                ]);
            }

            return response()->view('producer-applications.unavailable', [
                'id' => $id,
                'action' => $action,
                'reason' => $input['reason'] ?? null,
                'notSent' => false,
            ], 503);
        }

        $request->session()->forget('producer_decision_draft');

        $message = match ($action) {
            'approve' => 'Application approved. This producer can now sell.',
            'reject' => 'Application rejected. The producer can review the reason and resubmit.',
            'suspend' => 'Producer suspended. New sales and auctions are blocked; existing orders and active auctions continue.',
            'reinstate' => 'Producer reinstated to approved. Product publication and moderation decisions remain unchanged.',
        };

        return redirect()->route('producer-applications.show', $updated->id)->with('notice', $message);
    }

    public function discardDraft(Request $request, string $id): RedirectResponse
    {
        if (! $this->validId($id)) {
            abort(404);
        }

        $draft = $request->session()->get('producer_decision_draft');
        if (is_array($draft) && ($draft['id'] ?? null) === $id) {
            $request->session()->forget('producer_decision_draft');
        }

        return redirect()->route('producer-applications.show', $id);
    }

    /** @param array{id: string, action: string, reason: string}|null $decisionDraft */
    private function detail(AdminProducerApplication $application, ?array $decisionDraft = null): View
    {
        return view('producer-applications.show', [
            'application' => $application,
            'decisionDraft' => $decisionDraft,
        ]);
    }

    /** @return array<string, mixed> */
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

    private function validId(string $id): bool
    {
        return preg_match('/\A[a-f\d]{24}\z/i', $id) === 1;
    }
}
