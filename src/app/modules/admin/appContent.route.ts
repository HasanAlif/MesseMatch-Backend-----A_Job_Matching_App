import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { adminController } from "./admin.controller";
import { UserRole } from "../../models";
import { appContentValidation } from "./appContent.validation";

const router = express.Router();

router.get("/:type", adminController.getContentByType);

router.patch(
  "/:type",
  auth(UserRole.ADMIN),
  validateRequest(appContentValidation.updateSchema),
  adminController.createOrUpdateContent,
);

export const appContentRoutes = router;
