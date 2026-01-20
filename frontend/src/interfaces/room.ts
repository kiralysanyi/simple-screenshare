interface room {
    id: string,
    roomname: string,
    viewers: number,
    limit: number,
    hostname?: string
}

export type { room };