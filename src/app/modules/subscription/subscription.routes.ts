import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { subscriptionController } from "./subscription.controller";
import { subscriptionValidation } from "./subscription.validation";
import { UserRole } from "../../models";

const router = express.Router();

router.post(
  "/swipe",
  auth(UserRole.FITTER),
  subscriptionController.incrementSwipeCount,
);

router.post(
  "/plan",
  auth(UserRole.FITTER, UserRole.COMPANY),
  validateRequest(subscriptionValidation.updatePlanSchema),
  subscriptionController.updatePlan,
);

export const subscriptionRoutes = router;
