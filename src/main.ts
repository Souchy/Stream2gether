import Aurelia, { ConsoleSink, LoggerConfiguration, LogLevel } from 'aurelia';
import { RouterConfiguration } from '@aurelia/router';
import { MyApp } from './my-app';
import { createClient } from '@supabase/supabase-js';
import { Database } from './core/generated/database.types';
import { NotificationContainer } from './components/notification-container/NotificationContainer';
import { INotificationService } from './core/services/NotificationService';
import { RoomPage } from './pages/room-page/RoomPage';
import { RoomStream } from './pages/room-page/room-stream/RoomStream';
import { RoomMemberList } from './pages/room-page/room-members-list/RoomMemberList';
import { Splitgrid } from './components/splitgrid/splitgrid';
import { IdentifyView } from './pages/identify-view/IdentifyView';
import { StreamSettings } from './pages/room-page/room-stream/stream-settings/StreamSettings';
import { StreamSettingsService } from './core/services/StreamSettingsService';

export const supabase = createClient<Database>(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY, {
  auth: {
    // debug: true,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: {
      getItem: (key: string) => {
        return localStorage.getItem(key);
      },
      setItem: (key: string, value: string) => {
        localStorage.setItem(key, value);
      },
      removeItem: (key: string) => {
        localStorage.removeItem(key);
      }
    }
  },
});

async function startApp() {
  const au = new Aurelia();

  // Logger for development
  if (import.meta.env.VITE_NODE_ENV !== 'production') {
    const logger = LoggerConfiguration.create({
      level: LogLevel.debug,
      colorOptions: 'colors',
      sinks: [ConsoleSink]
    });
    au.register(logger);
  }

  // Router
  au.register(RouterConfiguration.customize({
    useNavigationModel: true,
    useUrlFragmentHash: false,
    historyStrategy: 'push',
    basePath: import.meta.env.VITE_BASE,
  }));

  // Registers
  au.register(NotificationContainer, INotificationService)
  au.register(Splitgrid);
  au.register(IdentifyView);
  au.register(RoomPage, RoomMemberList, RoomMemberList, RoomStream, StreamSettings, StreamSettingsService);

  await au.app(MyApp).start();
}

void startApp();
