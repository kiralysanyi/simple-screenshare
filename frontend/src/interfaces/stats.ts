interface stats {
    worker: { cpu: string, memory: string, ctxSwitches: number }
    netstat: {inKbps: number, outKbps: number}
}

export type {stats}