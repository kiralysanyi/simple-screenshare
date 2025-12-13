const getBaseUrl = (): string => {
    let url = ""
    if (import.meta.env.DEV == true) {
        url = "http://localhost:9000"
    }
    return url;
}

export default getBaseUrl