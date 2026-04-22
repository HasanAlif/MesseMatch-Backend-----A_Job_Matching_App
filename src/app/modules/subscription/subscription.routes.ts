import express from "express";
import auth from "../../middlewares/auth";
import { subscriptionController } from "./subscription.controller";
import { UserRole } from "../../models";

const router = express.Router();

router.post(
  "/swipe",
  auth(UserRole.FITTER),
  subscriptionController.incrementSwipeCount,
);

export const subscriptionRoutes = router;
