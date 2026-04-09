import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { jobController } from "./job.controller";
import { jobValidation } from "./job.validation";
import { UserRole } from "../../models";
import { fileUploader } from "../../../helpars/fileUploader";

const router = express.Router();

router.post(
  "/",
  auth(UserRole.COMPANY),
  fileUploader.upload.single("projectPicture"),
  validateRequest(jobValidation.createSchema),
  jobController.createJob,
);

router.patch(
  "/:id",
  auth(UserRole.COMPANY),
  fileUploader.upload.single("projectPicture"),
  validateRequest(jobValidation.updateSchema),
  jobController.updateJob,
);

router.get("/my-jobs", auth(UserRole.COMPANY), jobController.getMyJobs);

router.patch(
  "/:jobId/status",
  auth(UserRole.COMPANY),
  validateRequest(jobValidation.changeJobStatusSchema),
  jobController.changeJobStatus,
);

router.delete("/:id", auth(UserRole.COMPANY), jobController.deleteJob);

export const jobRoutes = router;
