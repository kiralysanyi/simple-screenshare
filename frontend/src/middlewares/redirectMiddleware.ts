import { redirect, type MiddlewareFunction } from "react-router";

// this middleware is used instead of a 404 page. If a requested page not found we just simply redirect to the root.
const redirectMiddleware:MiddlewareFunction = ({}) => {
    throw redirect("/")
}

export default redirectMiddleware;