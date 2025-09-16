import { auth } from "express-oauth2-jwt-bearer";

const authenticateUser = auth({
    audience: process.env.AUDIENCE,
    issuerBaseURL: process.env.ISSUERBASEURL

});

export default authenticateUser