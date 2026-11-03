import { Link } from '@tanstack/react-router';
import type { Notification } from '../notifications';

export function NotificationLink({
  notification,
  role,
  onNavigate,
}: {
  notification: Notification;
  role: string;
  onNavigate?: () => void;
}) {
  const resourceId = notification.resource.id;
  if (!/^[a-f\d]{24}$/i.test(resourceId)) return null;

  if (notification.resource.type === 'order' && role === 'producer')
    return (
      <Link
        to="/producer/orders/$orderId"
        params={{ orderId: resourceId }}
        search={{ page: 1 }}
        onClick={onNavigate}
        className="notification-resource-link"
      >
        View order
      </Link>
    );
  if (notification.resource.type === 'order' && role === 'buyer')
    return (
      <Link
        to="/orders/$orderId"
        params={{ orderId: resourceId }}
        search={{ page: 1 }}
        onClick={onNavigate}
        className="notification-resource-link"
      >
        View order
      </Link>
    );
  if (notification.resource.type === 'producer_application')
    return (
      <Link
        to="/producer"
        onClick={onNavigate}
        className="notification-resource-link"
      >
        View application
      </Link>
    );
  return null;
}
