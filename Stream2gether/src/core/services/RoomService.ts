import { RealtimeChannel, RealtimePresenceState } from "@supabase/supabase-js";
import { ILogger, resolve } from "aurelia";
import { INotificationService } from "src/core/services/NotificationService";
import { supabase } from "src/main";
import { NameService } from "./NameService";
import { IRouter } from "@aurelia/router";

export type LobbyMemberStatus = "pending" | "joined" | "kicked";

export type RoomPresence = {
	user_id: string;
	display_name: string;
	role: "host" | "viewer";
	lobby_status: "pending" | "joined";
	connected_at: string;
};

type JoinLobbyResult = {
	lobby_id: string;
	host_id: string;
	status: LobbyMemberStatus;
};

export class RoomSessionService {
	private readonly logger = resolve(ILogger).scopeTo("RoomSessionService");
	private readonly notifications = resolve(INotificationService);
	private readonly names = resolve(NameService);
	private readonly router = resolve(IRouter);

	private channel?: RealtimeChannel;
	private connectedAt?: string;

	public roomId?: string;
	public roomCode?: string;
	public roomStatus?: LobbyMemberStatus;
	public roomHostId?: string;
	public currentUserId?: string;
	public displayName?: string;

	public onlineUsers: RoomPresence[] = [];

	public get isOwner(): boolean {
		return !!this.currentUserId && !!this.roomHostId && this.currentUserId === this.roomHostId;
	}

	public get onlineViewerCount(): number {
		return this.onlineUsers.filter(x => x.role === "viewer").length;
	}

	public get hostOnline(): boolean {
		return this.onlineUsers.some(x => x.user_id === this.roomHostId);
	}


	//#region Lifecycle
	public async joinByCode(code: string): Promise<boolean> {
		const signedIn = await this.ensureSignedIn();
		if (!signedIn)
			return false;

		const { data, error } = await supabase.rpc("join_lobby", {
			arg_code: code,
		});

		if (error) {
			this.notifications.error("Failed to join room", error.message, 5000);
			this.logger.error("join_lobby failed", error);
			return false;
		}

		const result = data?.[0] as JoinLobbyResult | undefined;
		if (!result) {
			this.notifications.error("Failed to join room", "No room data returned", 5000);
			return false;
		}

		this.roomCode = code;
		this.roomId = result.lobby_id;
		this.roomHostId = result.host_id;
		this.roomStatus = result.status;
		return true;
	}
	
	public async ensureSignedIn(): Promise<boolean> {
		const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
		if (sessionError) {
			this.notifications.error("Failed to get session", sessionError.message, 5000);
			return false;
		}

		if (!sessionData.session) {
			const authResponse = await supabase.auth.signInAnonymously();
			if (authResponse.error) {
				this.notifications.error("Failed to sign in", authResponse.error.message, 5000);
				this.logger.debug(`Failed to sign in:`, authResponse);
				return false;
			}
		}

		const { data: userData, error: userError } = await supabase.auth.getUser();
		if (userError || !userData.user) {
			this.notifications.error("Failed to get user", userError?.message ?? "Unknown error", 5000);
			return false;
		}

		this.currentUserId = userData.user.id;
		return true;
	}

	public async connect(): Promise<void> {
		this.displayName ??= await this.names.resolveDisplayName();

		if (!this.roomId || !this.currentUserId) return;
		if (this.roomStatus !== "pending" && this.roomStatus !== "joined") return;

		await this.disconnect();

		this.connectedAt = new Date().toISOString();

		this.channel = supabase.channel(`lobby:${this.roomId}`, {
			config: {
				presence: {
					key: this.currentUserId,
				},
			},
		});

		this.channel.on("presence", { event: "sync" }, () => {
			const state = this.channel?.presenceState<RoomPresence>() ?? {};
			this.onlineUsers = this.flattenPresenceState(state);
			this.logger.debug("presence sync", this.onlineUsers);
		});

		this.channel.on("presence", { event: "join" }, ({ key, newPresences }) => {
			this.logger.debug("presence join", { key, newPresences });
		});

		this.channel.on("presence", { event: "leave" }, ({ key, leftPresences }) => {
			this.logger.debug("presence leave", { key, leftPresences });
		});


		this.channel.on("postgres_changes",
			{
				event: "*",
				schema: "public",
				table: "lobby_members",
				filter: `lobby_id=eq.${this.roomId}`,
			},
			async (payload) => {
				this.logger.debug("lobby_members changed", payload);

				const row = (payload.new || payload.old) as { user_id?: string; status?: LobbyMemberStatus } | undefined;
				// only check when current user gets updated
				if (!row || row.user_id !== this.currentUserId) return;

				if (payload.eventType !== "DELETE" && row.status) {
					// Update the current status and share it to the other users
					this.roomStatus = row.status;

					if (this.roomStatus === "pending" || this.roomStatus === "joined") {
						await this.syncPresence();
					}
				}
			}
		);

		this.channel.on("postgres_changes",
			{
				event: "*",
				schema: "public",
				table: "lobbies",
				filter: `id=eq.${this.roomId}`,
			},
			(payload) => {
				this.logger.debug("lobbies changed", payload);

				if (payload.eventType === "DELETE") {
					this.notifications.info("Room closed", "The room was closed by the host.", 3);
					// navigate back to main page
					this.router.load("welcome");
				}
			}
		);

		await this.channel.subscribe(async (status) => {
			this.logger.debug("channel status", status);

			if (status !== "SUBSCRIBED") return;
			await this.syncPresence();
		});
	}

	public async disconnect(): Promise<void> {
		if (this.channel) {
			await this.channel.unsubscribe();
			this.channel = undefined;
		}
		
		// if (this.roomId) {
		// 	void supabase.rpc("leave_lobby", { target_lobby_id: this.roomId }).then(response => {
		// 	});
		// }

		this.onlineUsers = [];
		this.connectedAt = undefined;
	}
	//#endregion

	public async changeDisplayName(newName: string): Promise<void> {
		const trimmed = newName.trim();
		this.displayName = trimmed;
		this.names.saveLocalDisplayName(this.displayName);
		await this.syncPresence();
	}

	public async syncPresence(): Promise<void> {
		if (!this.channel || !this.currentUserId || !this.connectedAt) return;
		if (this.roomStatus !== "pending" && this.roomStatus !== "joined") return;

		await this.channel.track({
			user_id: this.currentUserId,
			display_name: this.displayName || "anonymous",
			role: this.isOwner ? "host" : "viewer",
			lobby_status: this.roomStatus,
			connected_at: this.connectedAt,
		} satisfies RoomPresence);
	}

	private flattenPresenceState(state: RealtimePresenceState<RoomPresence>): RoomPresence[] {
		const result: RoomPresence[] = [];

		for (const key of Object.keys(state)) {
			const entries = state[key] ?? [];
			for (const entry of entries) {
				result.push(entry);
			}
		}

		return result;
	}

}
