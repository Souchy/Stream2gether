import { singleton } from "aurelia";
import { supabase } from "src/main";


@singleton()
export class NameService {
	public async resolveDisplayName(): Promise<string> {
		const { data } = await supabase.auth.getUser();
		const user = data.user;

		const providerName =
			user?.user_metadata?.name ||
			user?.user_metadata?.full_name ||
			user?.user_metadata?.preferred_name;

		if (typeof providerName === "string" && providerName.trim().length > 0) {
			return providerName.trim();
		}

		const savedLocalName = localStorage.getItem("display_name");
		if (savedLocalName && savedLocalName.trim().length > 0) {
			return savedLocalName.trim();
		}

		const generated = this.generateRandomName();
		localStorage.setItem("display_name", generated);
		return generated;
	}

	public saveLocalDisplayName(displayName?: string) {
		if (displayName == null || displayName.length == 0)
			localStorage.removeItem("display_name");
		else
			localStorage.setItem("display_name", displayName);
	}

	public generateRandomName(): string {
		const adjectives = ["Swift", "Blue", "Quiet", "Lucky", "Mellow", "Bright"];
		const animals = ["Otter", "Fox", "Raven", "Panda", "Lynx", "Koala", "Banana", "Kitten"];

		const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
		const animal = animals[Math.floor(Math.random() * animals.length)];
		const number = Math.floor(Math.random() * 1000);

		return `${adjective}${animal}${number}`;
	}

}
