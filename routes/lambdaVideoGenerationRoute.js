// routes/lambdaVideoGenerationRoute.js
import express from "express";
import { lambdaVideoGenerationController } from "../controllers/lambdaVideoGenerationController.js";

const router = express.Router();

router.post("/", lambdaVideoGenerationController);

export default router;
