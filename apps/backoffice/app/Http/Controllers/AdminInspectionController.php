<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\ApiSessionExpired;
use App\Exceptions\BackofficeUnavailable;
use App\Exceptions\InspectionRecordNotFound;
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

            return view('inspection.user', ['user' => $user]);
        } catch (ApiSessionExpired|UnexpectedValueException) {
            return $this->expired($request);
        } catch (InspectionRecordNotFound) {
            abort(404);
        } catch (BackofficeUnavailable|ConnectionException) {
            return $this->unavailable('inspection.user', ['id' => $id]);
        }
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

    public function health(Request $request): View|RedirectResponse|HttpResponse
    {
        try {
            $health = $this->inspection->health($this->credentials($request));

            return view('inspection.health', ['health' => $health, 'checkedAt' => now()->toIso8601String()]);
        } catch (ApiSessionExpired|UnexpectedValueException) {
            return $this->expired($request);
        } catch (BackofficeUnavailable|ConnectionException) {
            return $this->unavailable('inspection.health');
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
