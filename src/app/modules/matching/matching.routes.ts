import express from "express";
import auth from "../../middlewares/auth";
import { matchingController } from "./matching.controller";
import { UserRole } from "../../models";

const router = express.Router();

router.get(
  "/fitter",
  auth(UserRole.FITTER),
  matchingController.getMatchingJobsForFitter,
);

export const matchingRoutes = router;
