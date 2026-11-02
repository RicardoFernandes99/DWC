import { formatLabel } from '@/lib/format';
import type { components } from '@/lib/api-schema';

type Order = components['schemas']['OrderResponseDto'];
type OrderStatus = Order['status'];

const deliverySteps: OrderStatus[] = [
  'pending',
  'confirmed',
  'shipped',
  'delivered',
];
const collectionSteps: OrderStatus[] = [
  'pending',
  'confirmed',
  'ready_for_collection',
  'collected',
];

export function orderSteps(method: Order['fulfilmentMethod']) {
  return method === 'delivery' ? deliverySteps : collectionSteps;
}

export function orderStatusText(status: OrderStatus) {
  return status === 'ready_for_collection'
    ? 'Ready for collection'
    : formatLabel(status);
}

export function orderDateLabel(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
