
/* SERVER CONEXION - ORIGINAL*/
export default {
    PORT: process.env.PORT || 27017,
    MONGODB_HOST: process.env.MONGODB_HOST || "127.0.0.1",
    MONGODB_DATABASE: process.env.MONGODB_DB || "cem-db_distribuccion",
    MONGODB_URI: `mongodb://${process.env.MONGODB_HOST || "127.0.0.1"}/${process.env.MONGODB_DATABASE || "cem-db_distribuccion"}`,
}   



 

/* export default {

    local conexion database 

    PORT: process.env.PORT || 27017,
    MONGODB_HOST: process.env.MONGODB_HOST || "127.0.0.1",
    MONGODB_DATABASE: process.env.MONGODB_DB || "cem-db_distribucion",
    MONGODB_URI: `mongodb://${process.env.MONGODB_HOST || "127.0.0.1"}/${process.env.MONGODB_DATABASE || "cem-db_distribucion"
        }`,
}    */