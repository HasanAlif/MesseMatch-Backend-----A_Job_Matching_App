import mongoose from "mongoose";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import { User, UserRole, Plan } from "../../models";

interface SwipeCountResponse {
  swipeCount: number;
  remainingSwipes?: number;
  updatedAt: Date;
}

interface UpdatePlanResponse {
  plan: Plan;
  updatedAt: Date;
}

const FITTER_PLANS = [Plan.FREE, Plan.PREMIUM_DE, Plan.PREMIUM_EU];
const COMPANY_PLANS = [
  Plan.FREE,
  Plan.LAUNCH_PREMIUM,
  Plan.BASIC,
  Plan.PREMIUM,
];

const SWIPE_LIMITS: Record<Plan, number | null> = {
  [Plan.FREE]: 30,
  [Plan.PREMIUM_DE]: null,
  [Plan.PREMIUM_EU]: null,
  [Plan.LAUNCH_PREMIUM]: null,
  [Plan.BASIC]: null,
  [Plan.PREMIUM]: null,
};

const isNewMonth = (resetDate: Date | undefined): boolean => {
  if (!resetDate) return true;

  const now = new Date();
  const lastReset = new Date(resetDate);

  return (
    now.getMonth() !== lastReset.getMonth() ||
    now.getFullYear() !== lastReset.getFullYear()
  );
};

const formatResetDate = (date: Date): string => {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
  }).format(date);
};

const swipeCountForFitter = async (
  fitterId: string,
): Promise<SwipeCountResponse> => {
  if (!fitterId || !mongoose.Types.ObjectId.isValid(fitterId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid fitter ID");
  }

  const user = await User.findById(fitterId).select(
    "plan swipeCount swipeCountResetAt",
  );

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "Fitter not found");
  }

  const userPlan = user.plan || Plan.FREE;
  const swipeLimit = SWIPE_LIMITS[userPlan];

  const resetNeeded = isNewMonth(user.swipeCountResetAt);
  let currentSwipeCount = user.swipeCount || 0;

  if (resetNeeded) {
    currentSwipeCount = 0;
    await User.findByIdAndUpdate(
      fitterId,
      {
        swipeCount: 0,
        swipeCountResetAt: new Date(),
      },
      { runValidators: false },
    );
  }

  if (swipeLimit !== null && currentSwipeCount >= swipeLimit) {
    const nextResetDate = new Date();
    nextResetDate.setMonth(nextResetDate.getMonth() + 1);

    throw new ApiError(
      httpStatus.PAYMENT_REQUIRED,
      `You've reached your ${swipeLimit} swipes for ${formatResetDate(new Date())}. Upgrade to Premium for unlimited swipes and unlock more features! 🚀`,
    );
  }

  const updatedUser = await User.findByIdAndUpdate(
    fitterId,
    { $inc: { swipeCount: 1 } },
    { new: true, runValidators: false },
  ).select("swipeCount updatedAt");

  if (!updatedUser) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to update swipe count",
    );
  }

  const newSwipeCount = updatedUser.swipeCount || 0;
  const remainingSwipes =
    swipeLimit !== null ? Math.max(0, swipeLimit - newSwipeCount) : undefined;

  return {
    swipeCount: newSwipeCount,
    remainingSwipes,
    updatedAt: updatedUser.updatedAt,
  };
};

const updatePlanStatus = async (
  userId: string,
  newPlan: Plan,
): Promise<UpdatePlanResponse> => {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  const user = await User.findById(userId).select("role plan");
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  const allowedPlans =
    user.role === UserRole.FITTER ? FITTER_PLANS : COMPANY_PLANS;
  if (!allowedPlans.includes(newPlan)) {
    const roleDisplay = user.role === UserRole.FITTER ? "fitter" : "company";
    throw new ApiError(
      httpStatus.FORBIDDEN,
      `Plan "${newPlan}" is not available for ${roleDisplay} role. Available plans: ${allowedPlans.join(", ")}`,
    );
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { plan: newPlan },
    { new: true, runValidators: false },
  ).select("plan updatedAt");

  if (!updatedUser) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to update plan",
    );
  }

  return {
    plan: updatedUser.plan || Plan.FREE,
    updatedAt: updatedUser.updatedAt,
  };
};

export const subscriptionService = {
  swipeCountForFitter,
  updatePlanStatus,
};
