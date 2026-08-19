

export type LobbyMemberStatus = "pending" | "joined" | "kicked" | "quit";

export type Room = {
	// id: string,
	// host_id: string,
    lobby_id: string;
	code: string;
    host_id: string;
    is_host: boolean;
    requires_approval: boolean;
    status: LobbyMemberStatus;
    expires_at: string;
}
