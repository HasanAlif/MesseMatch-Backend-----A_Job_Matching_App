import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { matchingController } from "./matching.controller";
import { matchingValidation } from "./matching.validation";
import { UserRole } from "../../models";

const router = express.Router();

router.get(
  "/fitter",
  auth(UserRole.FITTER),
  matchingController.getMatchingJobsForFitter,
);

router.post(
  "/search-filter",
  auth(UserRole.FITTER),
  validateRequest(matchingValidation.searchAndFilterJobsSchema),
  matchingController.searchAndFilterJobs,
);

router.post(
  "/request",
  auth(UserRole.FITTER),
  validateRequest(matchingValidation.requestForJobSchema),
  matchingController.requestForJob,
);

router.get(
  "/company/requests",
  auth(UserRole.COMPANY),
  matchingController.getIncomingRequestsForCompany,
);

router.get(
  "/company/requests/active",
  auth(UserRole.COMPANY),
  matchingController.getActiveJobRequestsForCompany,
);

router.patch(
  "/company/requests/:requestId",
  auth(UserRole.COMPANY),
  validateRequest(matchingValidation.updateRequestStatusSchema),
  matchingController.updateRequestStatusForCompany,
);

router.patch(
  "/company/requests/:requestId/complete",
  auth(UserRole.COMPANY),
  matchingController.completeJobRequestForCompany,
);

router.get(
  "/company/requests/completed",
  auth(UserRole.COMPANY),
  matchingController.getCompletedJobRequestsForCompany,
);

router.patch(
  "/company/requests/:requestId/rate-and-review",
  auth(UserRole.COMPANY),
  validateRequest(matchingValidation.giveRatingAndReviewSchema),
  matchingController.giveRatingAndReviewToFitter,
);

export const matchingRoutes = router;
