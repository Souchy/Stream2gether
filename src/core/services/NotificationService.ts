// src/services/notification-service.ts
import { DI, ILogger, resolve, singleton } from '@aurelia/kernel';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration: number; // milliseconds, 0 = no auto-dismiss
  dismissible: boolean;
  timestamp: Date;
  expiresAt?: number;
  remaining?: number;
}

export const INotificationService = DI.createInterface<INotificationService>(
  'INotificationService',
  x => x.singleton(NotificationService)
);

export interface INotificationService {
  readonly notifications: Notification[];
  show(options: Partial<Notification>): string;
  success(title: string, message: string, duration?: number): string;
  error(title: string, message: string, duration?: number): string;
  warning(title: string, message: string, duration?: number): string;
  info(title: string, message: string, duration?: number): string;
  dismiss(id: string): void;
  clear(): void;
}

@singleton()
class NotificationService implements INotificationService {
  private readonly logger = resolve(ILogger);

  notifications: Notification[] = [];
  private nextId = 1;
  private timers = new Map<string, number>();
  private progressTimers = new Map<string, number>();

  show(options: Partial<Notification>): string {
    const notification: Notification = {
      id: `notification-${this.nextId++}`,
      type: options.type || 'info',
      title: options.title || '',
      message: options.message || '',
      duration: options.duration !== undefined ? options.duration : 5000,
      dismissible: options.dismissible !== undefined ? options.dismissible : true,
      timestamp: new Date(),
      remaining: options.duration ?? 5000,
      expiresAt: options.duration ? Date.now() + options.duration : undefined
    };

    this.logger.debug("Notification: ", notification);

    // Add to beginning of array (newest first)
    this.notifications.unshift(notification);

    // Auto-dismiss if duration > 0
    if (notification.duration > 0) {
      const timer = window.setTimeout(() => {
        this.dismiss(notification.id);
      }, notification.duration);

      this.timers.set(notification.id, timer);

      const progress = window.setInterval(() => {
        if (!notification.expiresAt) return;
        const remaining = Math.max(notification.expiresAt - Date.now(), 0);
        notification.remaining = remaining;
        if (remaining <= 0) {
          window.clearInterval(progress);
          this.progressTimers.delete(notification.id);
        }
      }, 100);
      this.progressTimers.set(notification.id, progress);
    }

    return notification.id;
  }

  success(title: string, message: string, duration = 5000): string {
    return this.show({ type: 'success', title, message, duration });
  }

  error(title: string, message: string, duration = 0): string {
    // Errors don't auto-dismiss by default
    return this.show({ type: 'error', title, message, duration });
  }

  warning(title: string, message: string, duration = 7000): string {
    return this.show({ type: 'warning', title, message, duration });
  }

  info(title: string, message: string, duration = 5000): string {
    return this.show({ type: 'info', title, message, duration });
  }

  dismiss(id: string): void {
    // Clear timer if exists
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    const progress = this.progressTimers.get(id);
    if (progress) {
      clearInterval(progress);
      this.progressTimers.delete(id);
    }

    // Remove notification
    const index = this.notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      this.notifications.splice(index, 1);
    }
  }

  clear(): void {
    // Clear all timers
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.progressTimers.forEach(interval => clearInterval(interval));
    this.progressTimers.clear();

    // Clear all notifications
    this.notifications = [];
  }
}
