const multer = require("multer");
const path = require('path');
const { v4:  uuid  } = require('uuid');

const storage = multer.diskStorage({
    destination: path.join(__dirname, ('../tmp/files')) ,
    filename (req, file, cb) {
        console.log(file)
        cb(null, uuid() + path.extname(file.originalname));
    }
})

module.exports =  multer({ storage });