import { useEffect, useState } from "react"

const StatusIndicator = ({ status, message }: { status: "ok" | "loading" | "error", message: string }) => {
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        let timeout: number;
        if (status == "ok") {
            timeout = setTimeout(() => {
                setCollapsed(true)
            }, 5000);
        } else {
            setCollapsed(false)
        }

        return () => {
            clearTimeout(timeout)
        }
    }, [status])

    return <div className={`statusIndicator ${status} ${collapsed ? "collapsed" : ""}`}>
        {collapsed ? "" : <span>{message}</span>}
    </div>
}

export default StatusIndicator
