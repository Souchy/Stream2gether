

export type Room = {
	// id: string,
	// host_id: string,
    lobby_id: string;
	code: string;
    host_id: string;
    is_host: boolean;
    requires_approval: boolean;
    status: "pending" | "joined" | "kicked" | "quit";
    expires_at: string;
}
