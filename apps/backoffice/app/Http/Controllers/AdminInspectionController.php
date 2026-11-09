<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\ApiSessionExpired;
use App\Exceptions\BackofficeUnavailable;
use App\Exceptions\InspectionRecordNotFound;
use App\Exceptions\ProducerApiFailure;
use App\Services\NestAuthService;
use App\Services\NestInspectionService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use UnexpectedValueException;

final class AdminInspectionController
{
    private const ROLES = ['buyer', 'producer', 'admin'];

    private const PRODUCER_STATES = ['pending', 'approved', 'rejected', 'suspended'];

    private const ORDER_STATES = ['pending', 'confirmed', 'shipped', 'delivered', 'ready_for_collection', 'collected', 'cancelled'];

    private const ORIGINS = ['catalogue', 'auction'];

    private const FULFILMENT = ['delivery', 'collection'];

    private const AUCTION_STATES = ['scheduled', 'active', 'finished', 'cancelled'];

    public function __construct(
        private readonly NestInspectionService $inspection,
        private readonly NestAuthService $auth,
    ) {}

    public function users(Request $request): View|RedirectResponse|HttpResponse
    {
        $input = $this->query($request, ['role' => self::ROLES, 'producerStatus' => self::PRODUCER_STATES]);
        if ($input instanceof RedirectResponse) {
            return $input;
        }
        try {
            return view('inspection.users', $this->inspection->users($this->credentials($request), $input));
        } catch (ApiSessionExpired|UnexpectedValueException) {
            return $this->expired($request);
        } catch (BackofficeUnavailable|ConnectionException) {
            return $this->unavailable('inspection.users', $request->query());
        }
    }

    public function user(Request $request, string $id): View|RedirectResponse|HttpResponse
    {
        try {
            $user = $this->inspection->user($this->credentials($request), $id);
            if ($user['id'] !== $id) {
                throw new BackofficeUnavailable;
            }

            $draft = $request->session()->get('buyer_decision_draft');
            if (! is_array($draft) || ($draft['id'] ?? null) !== $id) {
                $draft = null;
            }

            return view('inspection.user', ['user' => $user, 'buyerDecisionDraft' => $draft]);
        } catch (ApiSessionExpired|UnexpectedValueException) {
            return $this->expired($request);
        } catch (InspectionRecordNotFound) {
            abort(404);
        } catch (BackofficeUnavailable|ConnectionException) {
            return $this->unavailable('inspection.user', ['id' => $id]);
        }
    }

    public function buyerStanding(Request $request, string $id, string $action): RedirectResponse|HttpResponse
    {
        if (! in_array($action, ['suspend', 'reinstate'], true)) {
            abort(404);
        }
        $input = Validator::make($request->all(), [
            'revision' => ['required', 'integer', 'min:0'],
            'reason' => [$action === 'suspend' ? 'required' : 'nullable', 'string', 'min:1', 'max:500'],
        ])->validate();
        $input['revision'] = (int) $input['revision'];
        if ($action === 'suspend') {
            $input['reason'] = trim($input['reason']);
        } else {
            unset($input['reason']);
        }
        try {
            $updated = $this->inspection->changeBuyerStanding($this->credentials($request), $id, $action, $input);
            if (($updated['id'] ?? null) !== $id) {
                throw new BackofficeUnavailable;
            }
        } catch (ApiSessionExpired|UnexpectedValueException) {
            return $this->expired($request);
        } catch (ProducerApiFailure $failure) {
            return redirect()->route('inspection.user', $id)
                ->withInput($input)
                ->with('buyer_standing_error', $failure->getMessage());
        } catch (BackofficeUnavailable|ConnectionException) {
            return response()->view('inspection.buyer-standing-unavailable', [
                'id' => $id,
                'action' => $action,
                'reason' => $input['reason'] ?? null,
            ], 503);
        }

        $request->session()->forget('buyer_decision_draft');

        return redirect()->route('inspection.user', $id)->with('notice', $action === 'suspend'
            ? 'Buyer suspended. New purchases and bids are blocked; existing orders and accepted bids continue.'
            : 'Buyer reinstated. New purchases and bids are available again.');
    }

    public function discardBuyerDraft(Request $request, string $id): RedirectResponse
    {
        $draft = $request->session()->get('buyer_decision_draft');
        if (is_array($draft) && ($draft['id'] ?? null) === $id) {
            $request->session()->forget('buyer_decision_draft');
        }

        return redirect()->route('inspection.user', $id);
    }

    public function orders(Request $request): View|RedirectResponse|HttpResponse
    {
        $input = $this->query($request, [
            'status' => self::ORDER_STATES, 'origin' => self::ORIGINS,
            'fulfilmentMethod' => self::FULFILMENT, 'buyerId' => null, 'producerId' => null,
        ]);
        if ($input instanceof RedirectResponse) {
            return $input;
        }
        try {
            return view('inspection.orders', $this->inspection->orders($this->credentials($request), $input));
        } catch (ApiSessionExpired|UnexpectedValueException) {
            return $this->expired($request);
        } catch (BackofficeUnavailable|ConnectionException) {
            return $this->unavailable('inspection.orders', $request->query());
        }
    }

    public function order(Request $request, string $id): View|RedirectResponse|HttpResponse
    {
        try {
            $order = $this->inspection->order($this->credentials($request), $id);
            if ($order['id'] !== $id) {
                throw new BackofficeUnavailable;
            }

            return view('inspection.order', ['order' => $order]);
        } catch (ApiSessionExpired|UnexpectedValueException) {
            return $this->expired($request);
        } catch (InspectionRecordNotFound) {
            abort(404);
        } catch (BackofficeUnavailable|ConnectionException) {
            return $this->unavailable('inspection.order', ['id' => $id]);
        }
    }

    public function orderReceipt(Request $request, string $id): HttpResponse|RedirectResponse
    {
        try {
            $pdf = $this->inspection->orderReceipt($this->credentials($request), $id);

            return response($pdf, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="purchase-receipt-'.$id.'.pdf"',
                'Cache-Control' => 'private, no-store',
                'X-Content-Type-Options' => 'nosniff',
            ]);
        } catch (ApiSessionExpired|UnexpectedValueException) {
            return $this->expired($request);
        } catch (InspectionRecordNotFound) {
            abort(404);
        } catch (BackofficeUnavailable|ConnectionException) {
            return $this->unavailable('inspection.order', ['id' => $id]);
        }
    }

    public function auctions(Request $request): View|RedirectResponse|HttpResponse
    {
        $input = $this->query($request, ['status' => self::AUCTION_STATES, 'producerId' => null]);
        if ($input instanceof RedirectResponse) {
            return $input;
        }
        try {
            return view('inspection.auctions', $this->inspection->auctions($this->credentials($request), $input));
        } catch (ApiSessionExpired|UnexpectedValueException) {
            return $this->expired($request);
        } catch (BackofficeUnavailable|ConnectionException) {
            return $this->unavailable('inspection.auctions', $request->query());
        }
    }

    public function auction(Request $request, string $id): View|RedirectResponse|HttpResponse
    {
        $input = $this->query($request, []);
        if ($input instanceof RedirectResponse) {
            return $input;
        }
        try {
            $auction = $this->inspection->auction($this->credentials($request), $id, $input);
            if ($auction['id'] !== $id) {
                throw new BackofficeUnavailable;
            }

            return view('inspection.auction', ['auction' => $auction]);
        } catch (ApiSessionExpired|UnexpectedValueException) {
            return $this->expired($request);
        } catch (InspectionRecordNotFound) {
            abort(404);
        } catch (BackofficeUnavailable|ConnectionException) {
            return $this->unavailable('inspection.auction', ['id' => $id] + $request->query());
        }
    }

    private function query(Request $request, array $filters): array|RedirectResponse
    {
        $rules = ['page' => ['nullable', 'integer', 'min:1', 'max:500'], 'limit' => ['nullable', 'integer', 'min:1', 'max:50']];
        foreach ($filters as $name => $values) {
            $rules[$name] = $values === null
                ? ['nullable', 'string', 'regex:/\A[a-fA-F0-9]{24}\z/']
                : ['nullable', 'string', Rule::in($values)];
        }
        $validator = Validator::make($request->query(), $rules);
        if ($validator->fails()) {
            return redirect()->route($this->listRoute($request))->withErrors($validator);
        }
        $input = $validator->validated();
        $input['page'] = (int) ($input['page'] ?? 1);
        $input['limit'] = (int) ($input['limit'] ?? 20);

        return $input;
    }

    private function listRoute(Request $request): string
    {
        return match ($request->route()->getName()) {
            'inspection.auction' => 'inspection.auctions',
            default => (string) $request->route()->getName(),
        };
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

    private function unavailable(string $routeName, array $parameters = []): HttpResponse
    {
        return response()->view('inspection.unavailable', ['routeName' => $routeName, 'routeParameters' => $parameters], 503);
    }
}
