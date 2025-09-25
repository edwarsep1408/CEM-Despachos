import express, { Router } from "express";
import personalCtr from "../controllers/personal.controllers";
import auth from "../middleware/authHttp";
const router = express.Router()

router.post('/post-personal', [auth.ensureAuth], personalCtr.postPersonal)
router.get('/get-personals',  [auth.ensureAuth], personalCtr.getPersonals)
router.get('/get-personal/:_id',  personalCtr.getPersonal)
router.put('/put-personal', [auth.ensureAuth], personalCtr.updatePersonal)
router.delete('/delete-personal/:_id', [auth.ensureAuth], personalCtr.deletePersonal)

export default router