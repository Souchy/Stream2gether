import { ILogger, IObserverLocator, resolve, singleton, watch } from "aurelia";
import { INotificationService } from "./NotificationService";

export type StreamSettingsData = {
	width: number,
	height: number,
	frameRate: number,
	audio: boolean,
}

@singleton()
export class StreamSettingsService {
	private readonly logger = resolve(ILogger).scopeTo("StreamSettingsService");
	private readonly notifications = resolve(INotificationService);
	private readonly observerLocator = resolve(IObserverLocator);

	public width: number = 1920;
	public height: number = 1080;
	public frameRate: number = 30;
	public audio: boolean = true;

	private saveTimer?: number;

	constructor() {
		this.load();
		this.setupWatchers();
	}

	public getDisplayMediaStreamOptions(): DisplayMediaStreamOptions {
		return {
			video: {
				width: { max: this.width },
				height: { max: this.height },
				frameRate: { max: this.frameRate }
			},
			audio: this.audio // Set to true if you want to attempt capturing system audio
		}
	}

	private load() {
		const raw = localStorage.getItem('stream_settings');
		if (!raw) return;
		try {
			const data: StreamSettingsData = JSON.parse(raw);
			// Object.assign updates the local properties
			Object.assign(this, data);
			this.logger.debug("Loaded stream settings", this);
		} catch (e) {
			this.logger.debug("Failed to load stream settings");
		}
	}

	private setupWatchers() {
		const keys: (keyof StreamSettingsService)[] = ['width', 'height', 'frameRate', 'audio'];
		for (const key of keys) {
			this.observerLocator.getObserver(this, key as string).subscribe({
				handleChange: () => this.onChange()
			});
		}
	}

	// @watch((vm: StreamSettingsService) => [vm.width, vm.height, vm.frameRate, vm.audio])
	// @watch(vm => vm.width)
	// @watch(vm => vm.height)
	// @watch(vm => vm.frameRate)
	// @watch(vm => vm.audio)
	public onChange() {
		clearTimeout(this.saveTimer);
		this.saveTimer = setTimeout(() => this.save(), 500);
	}

	private save() {
		// localStorage.setItem("stream_settings", JSON.stringify(this));
		localStorage.setItem('stream_settings', JSON.stringify({
			width: this.width,
			height: this.height,
			frameRate: this.frameRate,
			audio: this.audio
		}));
		this.logger.debug("Save stream settings", this);
		this.notifications.info("Saved settings", "", 1000);
	}

	public dispose() {
		if (this.saveTimer) {
			clearTimeout(this.saveTimer);
			this.save();
		}
	}

}
