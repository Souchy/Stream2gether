// src/components/notification-container.ts
import { resolve } from '@aurelia/kernel';
import { INotificationService } from 'src/core/services/NotificationService';

export class NotificationContainer {
  private notificationService = resolve(INotificationService);

  get notifications() {
    return this.notificationService.notifications;
  }

  dismiss(id: string) {
    this.notificationService.dismiss(id);
  }

  getIcon(type: string): string {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      case 'info': return 'ⓘ';
      default: return '';
    }
  }

  getProgressWidth(notification: any): number {
    if (notification.duration === 0) return 0;
    const remaining = notification.remaining ?? notification.duration;
    return Math.max((remaining / notification.duration) * 100, 0);
  }
}
