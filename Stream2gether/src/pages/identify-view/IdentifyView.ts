import { resolve, watch } from "aurelia";
import { NameService } from "src/core/services/NameService";


export class IdentifyView {
	private readonly names = resolve(NameService);

	public displayName: string = "";

	created() {
		this.names.resolveDisplayName().then(res => this.displayName = res);
	}

	@watch(vm => vm.displayName)
	private onNameChanged() {
		this.names.saveLocalDisplayName(this.displayName);
	}

}
