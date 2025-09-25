import mongoose from "mongoose";
import db from "../key";
import { success, error } from "consola";

(async () => {

    try {

        await mongoose.connect(db.MONGODB_URI);
        
        console.log(db.MONGODB_URI, "VALORES DATABASE");
        
        success({ message: `LA DB ESTA CONECTADA`, badge: true });

    } catch (err) {

        console.error(error({ message: err, badge: true }));

    }

})();