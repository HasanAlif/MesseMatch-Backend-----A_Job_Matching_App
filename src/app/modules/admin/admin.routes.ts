import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { adminController } from "./admin.controller";
import { UserRole } from "../../models";

const router = express.Router();

export const adminRoutes = router;
