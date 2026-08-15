import { resolve, watch } from "aurelia";
import { StreamSettingsService } from "src/core/services/StreamSettingsService";

export class StreamSettings {
	private readonly service = resolve(StreamSettingsService);

}
