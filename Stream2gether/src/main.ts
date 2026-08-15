import Aurelia, { ConsoleSink, LoggerConfiguration, LogLevel } from 'aurelia';
import { RouterConfiguration } from '@aurelia/router';
import { MyApp } from './my-app';
import { createClient } from '@supabase/supabase-js';
import { Database } from './core/generated/database.types';
import { NotificationContainer } from './components/notification-container/NotificationContainer';
import { INotificationService } from './core/services/NotificationService';

// Aurelia
//   .register(RouterConfiguration)
//   // To use HTML5 pushState routes, replace previous line with the following
//   // customized router config.
//   // .register(RouterConfiguration.customize({ useUrlFragmentHash: false }))
//   .app(MyApp)
//   .start();



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
  // if (import.meta.env.VITE_NODE_ENV !== 'production') {
  const logger = LoggerConfiguration.create({
    level: LogLevel.debug,
    colorOptions: 'colors',
    sinks: [ConsoleSink]
  });
  au.register(logger);
  // }

	// Router
	au.register(RouterConfiguration.customize({
		useNavigationModel: true,
		useUrlFragmentHash: false,
		historyStrategy: 'push',
		basePath: '/',
	}));

  
  // Registers
  au.register(NotificationContainer, INotificationService)


  await au.app(MyApp).start();
}

void startApp();
