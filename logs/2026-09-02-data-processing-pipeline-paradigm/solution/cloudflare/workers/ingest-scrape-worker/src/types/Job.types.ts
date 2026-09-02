export interface ILink {
	id : string;
	url : string;
	url_hash : string;
}

export interface IJob extends ILink {
	msg_id : string;
}